import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  RawBodyRequest,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { LemonSqueezyService } from './stripe.service';
import { FlexibleAuthGuard } from '../auth/flexible-auth.guard';

@Controller('lemonsqueezy')
export class LemonSqueezyController {
  private readonly logger = new Logger(LemonSqueezyController.name);

  constructor(private readonly lemonSqueezyService: LemonSqueezyService) {}

  /**
   * Create a checkout session for subscription
   */
  @Post('create-checkout-session')
  @UseGuards(FlexibleAuthGuard)
  async createCheckoutSession(
    @Req() req: any,
    @Body()
    body: { variantId: string; successUrl?: string; cancelUrl?: string },
  ) {
    try {
      const userId = req.user.id;
      console.log('userIddddd', userId);
      this.logger.error(`user Iddddddddddd on create checkout: ${userId}`);
      const { variantId, successUrl, cancelUrl } = body;

      if (!variantId) {
        throw new BadRequestException('variantId is required');
      }

      const defaultSuccessUrl = `${process.env.FRONTEND_URL}/redaction?checkout_success=true&trial_started=true`;
      const defaultCancelUrl = `${process.env.FRONTEND_URL}/pricing`;

      const checkout = await this.lemonSqueezyService.createCheckoutSession(
        userId,
        variantId,
        successUrl || defaultSuccessUrl,
        cancelUrl || defaultCancelUrl,
        true, // Enable 14-day free trial
        14, // Trial duration in days
      );

      return {
        checkoutId: checkout.id,
        url: checkout.attributes.url,
      };
    } catch (error) {
      this.logger.error(`Checkout session creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a billing portal session
   */
  @Post('create-portal-session')
  @UseGuards(FlexibleAuthGuard)
  async createPortalSession(
    @Req() req: any,
    @Body() body: { returnUrl?: string },
  ) {
    try {
      const userId = req.user.id;
      const returnUrl =
        body.returnUrl || `${process.env.FRONTEND_URL}/dashboard`;

      const session = await this.lemonSqueezyService.createPortalSession(
        userId,
        returnUrl,
      );

      return {
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`Portal session creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get subscription status
   */
  @Get('subscription-status')
  @UseGuards(FlexibleAuthGuard)
  async getSubscriptionStatus(@Req() req: any) {
    try {
      const userId = req.user.id;
      return await this.lemonSqueezyService.getSubscriptionStatus(userId);
    } catch (error) {
      this.logger.error(`Failed to get subscription status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed subscription information with usage and limits
   */
  @Get('detailed-subscription-info')
  @UseGuards(FlexibleAuthGuard)
  async getDetailedSubscriptionInfo(@Req() req: any) {
    try {
      const userId = req.user.id;
      return await this.lemonSqueezyService.getDetailedSubscriptionInfo(userId);
    } catch (error) {
      this.logger.error(
        `Failed to get detailed subscription info: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Manual trial activation (for testing/debugging)
   */
  @Post('activate-trial')
  @UseGuards(FlexibleAuthGuard)
  async activateTrial(@Req() req: any) {
    try {
      const userId = req.user.id;

      // Activate trial through service method
      const result = await this.lemonSqueezyService.activateManualTrial(userId);

      this.logger.log(
        `Manual trial activation result for user ${userId}:`,
        result,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to activate trial: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manual subscription sync (for testing/debugging)
   */
  @Post('sync-subscription')
  @UseGuards(FlexibleAuthGuard)
  async syncSubscription(@Req() req: any) {
    try {
      const userId = req.user.id;

      // Sync subscription from LemonSqueezy
      const result =
        await this.lemonSqueezyService.syncSubscriptionFromLemonSqueezy(userId);

      this.logger.log(
        `Manual subscription sync result for user ${userId}:`,
        result,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to sync subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get usage statistics
   */
  @Get('usage-stats')
  @UseGuards(FlexibleAuthGuard)
  async getUsageStats(@Req() req: any) {
    try {
      const userId = req.user.id;

      // Get current month stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      return await this.lemonSqueezyService.getUsageStats(
        userId,
        startOfMonth,
        endOfMonth,
      );
    } catch (error) {
      this.logger.error(`Failed to get usage stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * LemonSqueezy webhook endpoint
   * This endpoint receives events from LemonSqueezy
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string,
  ) {
    // Log all headers for debugging
    this.logger.log('=== WEBHOOK RECEIVED ===');
    this.logger.log(`Headers: ${JSON.stringify(req.headers)}`);
    this.logger.log(`Signature from header: ${signature}`);
    this.logger.log(`Request URL: ${req.url}`);
    this.logger.log(`Request Method: ${req.method}`);

    if (!signature) {
      this.logger.error('Missing x-signature header');
      this.logger.error(
        `Available headers: ${Object.keys(req.headers).join(', ')}`,
      );
      throw new BadRequestException('Missing x-signature header');
    }

    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        this.logger.error('Missing request body');
        throw new BadRequestException('Missing request body');
      }

      this.logger.log(`Raw body length: ${rawBody.length} bytes`);

      // Verify the webhook signature and parse the event
      const event = this.lemonSqueezyService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      this.logger.log(`eventtttttttttttttttttttttttttttttttttttt:  `, event);

      // Handle different event types
      switch (event.meta.event_name) {
        case 'subscription_created':
          this.logger.log(`✅ Webhook signature verified successfully`);
          this.logger.log(`Received webhook event: ${event.meta.event_name}`);
          await this.lemonSqueezyService.handleSubscriptionCreated(event);
          break;

        case 'subscription_updated':
          await this.lemonSqueezyService.handleSubscriptionUpdated(event);
          break;

        case 'subscription_cancelled':
        case 'subscription_expired':
          await this.lemonSqueezyService.handleSubscriptionDeleted(event);
          break;

        case 'subscription_payment_success':
          this.logger.log(
            `Payment succeeded for subscription: ${event.data.id}`,
          );
          break;

        case 'subscription_payment_failed':
          this.logger.log(`Payment failed for subscription: ${event.data.id}`);
          // You can handle failed payments here (send notifications, etc.)
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.meta.event_name}`);
      }

      this.logger.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===');
      return { received: true };
    } catch (error) {
      this.logger.error(`❌ Webhook error: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }
}
