"""
PII Detection Endpoint - Add this to app.py before the exception handler
"""

@app.post("/detect-pii")
async def detect_pii(
    fileId: str = Form(...),
    categories: str = Form(...),
    confidenceThreshold: float = Form(0.7)
):
    """
    Detect PII (Personally Identifiable Information) in a PDF document.
    
    Args:
        fileId: The file ID of the PDF to analyze
        categories: JSON string array of PII categories to detect
        confidenceThreshold: Minimum confidence score (0.0-1.0)
        
    Returns:
        JSON with findings array and statistics
    """
    pdf_doc = None
    try:
        logger.info(f"PII detection request received for file: {fileId}")
        
        # Sanitize filename
        try:
            safe_file_id = sanitize_filename(fileId)
        except ValueError as e:
            logger.warning(f"Invalid filename detected: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename format"
            )
        
        # Parse categories
        try:
            categories_list = json.loads(categories)
            if not isinstance(categories_list, list):
                raise ValueError("Categories must be a list")
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Invalid categories JSON: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid categories format"
            )
        
        # Validate confidence threshold
        if not 0.0 <= confidenceThreshold <= 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confidence threshold must be between 0.0 and 1.0"
            )
        
        # Get file path
        input_path = get_file_path(safe_file_id, "uploads")
        
        # Check file size
        file_size_mb = input_path.stat().st_size / (1024 * 1024)
        if file_size_mb > MAX_FILE_SIZE_MB:
            logger.warning(f"File too large: {file_size_mb}MB")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit"
            )
        
        # Open PDF
        try:
            pdf_doc = fitz.open(str(input_path))
        except Exception as e:
            logger.error(f"Failed to open PDF: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or corrupted PDF file"
            )
        
        findings = []
        page_count = len(pdf_doc)
        
        # Process each page
        for page_num in range(page_count):
            page = pdf_doc[page_num]
            
            # Extract text with position information
            text_instances = page.get_text("dict")
            
            # Process each block
            for block in text_instances.get("blocks", []):
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "")
                            bbox = span.get("bbox", [0, 0, 0, 0])
                            
                            # Detect PII in this text span
                            span_findings = PIIDetector.detect_in_text(
                                text=text,
                                bbox=list(bbox),
                                page_num=page_num + 1,  # 1-based page numbering
                                categories=categories_list,
                                confidence_threshold=confidenceThreshold
                            )
                            
                            findings.extend(span_findings)
        
        # Calculate statistics
        statistics = PIIDetector.calculate_statistics(findings)
        
        logger.info(f"PII detection completed: {len(findings)} findings in {page_count} pages")
        
        return {
            "status": "success",
            "findings": findings,
            "statistics": statistics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during PII detection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during PII detection"
        )
    finally:
        # Always close the PDF document if it was opened
        if pdf_doc is not None:
            try:
                pdf_doc.close()
            except Exception as e:
                logger.warning(f"Failed to close PDF document: {e}")
        
        # Clean up temporary downloaded file if using S3
        if STORAGE_TYPE == "s3" and 'input_path' in locals():
            try:
                input_path.unlink(missing_ok=True)
            except Exception as e:
                logger.warning(f"Failed to clean up temp file: {e}")