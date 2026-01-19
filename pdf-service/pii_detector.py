"""
Production-ready PII Detection Module for PDF Redaction Service
"""
import re
from typing import List, Dict, Any
from uuid import uuid4


class PIIDetector:
    """
    Detects Personally Identifiable Information (PII) in text.
    """
    
    # PII detection patterns
    PATTERNS = {
        "SSN": r'\b\d{3}-\d{2}-\d{4}\b',
        "EMAIL": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "PHONE": r'\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b',
        "CREDIT_CARD": r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
        "DATE_OF_BIRTH": r'\b(?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12][0-9]|3[01])[/-](?:19|20)\d{2}\b',
        "ZIP_CODE": r'\b\d{5}(?:-\d{4})?\b',
        "ADDRESS": r'\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir)\b',
    }
    
    # Name indicators for heuristic detection
    NAME_INDICATORS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Miss"]
    
    @staticmethod
    def luhn_check(card_number: str) -> bool:
        """
        Validate credit card number using Luhn algorithm.
        """
        try:
            digits = [int(d) for d in card_number if d.isdigit()]
            if len(digits) < 13 or len(digits) > 19:
                return False
            
            checksum = 0
            for i, digit in enumerate(reversed(digits)):
                if i % 2 == 1:
                    digit *= 2
                    if digit > 9:
                        digit -= 9
                checksum += digit
            return checksum % 10 == 0
        except:
            return False
    
    @staticmethod
    def calculate_confidence(category: str, text: str) -> float:
        """
        Calculate confidence score for a PII match.
        """
        if category == "SSN":
            return 0.95
        elif category == "EMAIL":
            # Higher confidence for common domains
            if any(domain in text.lower() for domain in ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']):
                return 0.95
            return 0.90
        elif category == "CREDIT_CARD":
            # Verify with Luhn algorithm
            card_num = re.sub(r'[-\s]', '', text)
            if PIIDetector.luhn_check(card_num):
                return 0.95
            return 0.70
        elif category == "PHONE":
            return 0.88
        elif category == "DATE_OF_BIRTH":
            return 0.85
        elif category == "ADDRESS":
            return 0.80
        elif category == "ZIP_CODE":
            return 0.82
        elif category == "NAME":
            return 0.75
        else:
            return 0.80
    
    @staticmethod
    def detect_in_text(
        text: str,
        bbox: List[float],
        page_num: int,
        categories: List[str],
        confidence_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Detect PII in a text span.
        
        Args:
            text: Text to analyze
            bbox: Bounding box [x1, y1, x2, y2]
            page_num: Page number (1-based)
            categories: List of PII categories to detect
            confidence_threshold: Minimum confidence score
            
        Returns:
            List of findings
        """
        findings = []
        
        # Check each PII pattern
        for category in categories:
            if category not in PIIDetector.PATTERNS:
                continue
            
            pattern = PIIDetector.PATTERNS[category]
            matches = re.finditer(pattern, text, re.IGNORECASE)
            
            for match in matches:
                confidence = PIIDetector.calculate_confidence(category, match.group())
                
                if confidence >= confidence_threshold:
                    # Calculate approximate position within bbox
                    match_start = match.start()
                    match_end = match.end()
                    text_length = len(text)
                    
                    # Estimate bbox for the match
                    if text_length > 0:
                        start_ratio = match_start / text_length
                        end_ratio = match_end / text_length
                        
                        x1, y1, x2, y2 = bbox
                        width = x2 - x1
                        
                        match_x1 = x1 + (width * start_ratio)
                        match_x2 = x1 + (width * end_ratio)
                        match_bbox = [match_x1, y1, match_x2, y2]
                    else:
                        match_bbox = bbox
                    
                    finding_id = f"{category}_{page_num}_{uuid4().hex[:8]}"
                    findings.append({
                        "id": finding_id,
                        "category": category,
                        "name": category.replace("_", " ").title(),
                        "text": match.group(),
                        "confidence": confidence,
                        "page": page_num,
                        "bbox": match_bbox
                    })
        
        # NAME detection (simple heuristic)
        if "NAME" in categories:
            for indicator in PIIDetector.NAME_INDICATORS:
                if indicator in text:
                    # Extract potential name after indicator
                    parts = text.split(indicator)
                    if len(parts) > 1:
                        # Get next 2-3 words after indicator
                        words_after = parts[1].strip().split()[:3]
                        if len(words_after) >= 2:
                            # Check if words look like names (capitalized)
                            if all(word[0].isupper() for word in words_after if word):
                                name_text = " ".join(words_after)
                                confidence = PIIDetector.calculate_confidence("NAME", name_text)
                                
                                if confidence >= confidence_threshold:
                                    finding_id = f"NAME_{page_num}_{uuid4().hex[:8]}"
                                    findings.append({
                                        "id": finding_id,
                                        "category": "NAME",
                                        "name": "Name",
                                        "text": f"{indicator} {name_text}",
                                        "confidence": confidence,
                                        "page": page_num,
                                        "bbox": bbox
                                    })
        
        return findings
    
    @staticmethod
    def calculate_statistics(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate statistics from findings.
        """
        statistics = {
            "total": len(findings),
            "by_category": {},
            "by_confidence": {
                "high": len([f for f in findings if f["confidence"] >= 0.9]),
                "medium": len([f for f in findings if 0.7 <= f["confidence"] < 0.9]),
                "low": len([f for f in findings if f["confidence"] < 0.7])
            }
        }
        
        # Count by category
        for finding in findings:
            category = finding["category"]
            statistics["by_category"][category] = statistics["by_category"].get(category, 0) + 1
        
        return statistics