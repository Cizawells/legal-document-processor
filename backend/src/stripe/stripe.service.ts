import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LemonSqueezyService {
  private readonly apiUrl = 'https://api.lemonsqueezy.com/v1';
  private readonly apiKey: string;
  private readonly logger = new Logger(LemonSqueezyService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('LEMONSQUEEZY_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('LEMONSQUEEZY_API_KEY not configured');
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    };
  }

  /**
   * Create a LemonSqueezy customer for a user
   */
  async createCustomer(
    userId: string,
    email: string,
    name: string,
  ): Promise<string> {
    try {
      const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
      if (!storeId) {
        throw new Error('LEMONSQUEEZY_STORE_ID not configured');
      }

      // First, try to find existing customer by email
      try {
        const existingCustomersResponse = await axios.get(
          `${this.apiUrl}/customers?filter[email]=${encodeURIComponent(email)}&filter[store_id]=${storeId}`,
          { headers: this.getHeaders() },
        );

        if (existingCustomersResponse.data.data.length > 0) {
          const existingCustomer = existingCustomersResponse.data.data[0];
          const customerId = existingCustomer.id;

          // Update user with existing customer ID
          await this.prisma.user.update({
            where: { id: userId },
            data: { lemonSqueezyCustomerId: customerId },
          });

          this.logger.log(
            `Found existing LemonSqueezy customer ${customerId} for user ${userId} with email ${email}`,
          );
          return customerId;
        }
      } catch (searchError) {
        this.logger.warn(
          `Failed to search for existing customer: ${searchError.message}`,
        );
        // Continue to create new customer
      }

      // Create new customer if none exists
      const response = await axios.post(
        `${this.apiUrl}/customers`,
        {
          data: {
            type: 'customers',
            attributes: {
              name,
              email,
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: storeId,
                },
              },
            },
          },
        },
        { headers: this.getHeaders() },
      );

      const customerId = response.data.data.id;
      this.logger.log('=== CUSTOMER idddd ===', customerId);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lemonSqueezyCustomerId: customerId },
      });

      this.logger.log(
        `Created LemonSqueezy customer ${customerId} for user ${userId}`,
      );
      return customerId;
    } catch (error) {
      // Handle specific case where email is already taken
      if (
        error.response?.status === 422 &&
        error.response?.data?.errors?.[0]?.source?.pointer ===
          '/data/attributes/email'
      ) {
        this.logger.warn(
          `Customer with email ${email} already exists in LemonSqueezy, but search failed. Attempting manual recovery.`,
        );

        // Try a different approach - search without store filter
        try {
          const fallbackResponse = await axios.get(
            `${this.apiUrl}/customers?filter[email]=${encodeURIComponent(email)}`,
            { headers: this.getHeaders() },
          );

          if (fallbackResponse.data.data.length > 0) {
            const existingCustomer = fallbackResponse.data.data[0];
            const customerId = existingCustomer.id;

            await this.prisma.user.update({
              where: { id: userId },
              data: { lemonSqueezyCustomerId: customerId },
            });

            this.logger.log(
              `Recovered existing LemonSqueezy customer ${customerId} for user ${userId}`,
            );
            return customerId;
          }
        } catch (fallbackError) {
          this.logger.error(
            `Fallback customer search also failed: ${fallbackError.message}`,
          );
        }
      }

      this.logger.error(
        `Failed to create LemonSqueezy customer: ${error.message}`,
      );
      if (error.response?.data) {
        this.logger.error(
          `LemonSqueezy API Error: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    variantId: string,
    successUrl: string,
    cancelUrl: string,
    enableTrial: boolean = true,
    trialDays: number = 14,
  ): Promise<any> {
    try {
      // Check API key first
      if (!this.apiKey) {
        throw new Error('LEMONSQUEEZY_API_KEY not configured');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get or create LemonSqueezy customer
      let customerId = user.lemonSqueezyCustomerId;
      if (!customerId) {
        customerId = await this.createCustomer(userId, user.email, user.name);
      }

      const storeId = this.configService.get<string>('LEMONSQUEEZY_STORE_ID');
      this.logger.log('=== STORE idddd ===', storeId);
      if (!storeId) {
        throw new Error('LEMONSQUEEZY_STORE_ID not configured');
      }

      const requestData = {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
            },
            checkout_data: {
              email: user.email,
              name: user.name,
              custom: {
                user_id: userId,
                internal_user_id: userId, // Additional backup field
              },
            },
            product_options: enableTrial
              ? {
                  enabled_variants: [variantId],
                  redirect_url: successUrl,
                  receipt_button_text: 'Continue to App',
                  receipt_link_url: successUrl,
                }
              : {},
            expires_at: null,
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: variantId,
              },
            },
          },
        },
      };

      // Log the request data for debugging
      this.logger.log('=== CHECKOUT CREATION DEBUG ===');
      this.logger.log(
        `Creating checkout for user ${userId} with email ${user.email}`,
      );
      this.logger.log(
        'Custom data being sent:',
        requestData.data.attributes.checkout_data.custom,
      );

      const response = await axios.post(
        `${this.apiUrl}/checkouts`,
        requestData,
        { headers: this.getHeaders() },
      );

      const checkout = response.data.data;
      this.logger.log(
        `✅ Created checkout session ${checkout.id} for user ${userId}`,
      );
      this.logger.log('Checkout URL:', checkout.attributes.url);
      return checkout;
    } catch (error) {
      this.logger.error(`Failed to create checkout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a customer portal session
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscriptions: {
            where: { status: { in: ['active', 'on_trial'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!user.subscriptions.length) {
        throw new BadRequestException('No active subscription found');
      }

      const subscription = user.subscriptions[0];

      // LemonSqueezy customer portal URL format
      const portalUrl = `https://app.lemonsqueezy.com/my-orders/${user.lemonSqueezySubscriptionId}`;

      this.logger.log(`Created portal session for user ${userId}`);
      return { url: portalUrl };
    } catch (error) {
      this.logger.error(`Failed to create portal session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle subscription created webhook
   */
  async handleSubscriptionCreated(event: any): Promise<void> {
    try {
      // Log the entire event object to debug the structure
      this.logger.log('=== SUBSCRIPTION CREATED WEBHOOK DEBUG ===');
      this.logger.log(
        'Full event data:',
        JSON.stringify(event, null, 2),
      );

      // Extract user_id from event.meta.custom_data.user_id as corrected by user
      let userId = event.meta?.custom_data?.user_id;
      
      this.logger.log('User ID from meta.custom_data:', userId);

      // If not found in meta.custom_data, try other locations as fallback
      if (!userId) {
        // Try subscription data custom fields
        userId = event.data?.attributes?.custom_data?.user_id;
      }

      // Try multiple possible paths for user_id - LemonSqueezy stores custom data differently
      // The most common location is in the order's custom field or checkout custom data
      if (!userId) {
        userId = event.data?.custom_data?.user_id;
      }

      // If no userId found, try to find user by email first (LemonSqueezy provides user_email)
      if (!userId && event.data.attributes.user_email) {
        this.logger.log(
          `No userId found in webhook. Attempting to find user by email: ${event.data.attributes.user_email}`,
        );
        const user = await this.prisma.user.findFirst({
          where: {
            email: event.data.attributes.user_email,
          },
        });
        console.log('userrrrrrrrrrrr by email in webook', user);
        if (user) {
          userId = user.id;
          this.logger.log(
            `Found user ${userId} by email ${event.data.attributes.user_email}`,
          );
        }
      }

      // Also check if it's stored in the customer object or order data
      if (!userId && event.data.attributes.customer_id) {
        // Try to find user by LemonSqueezy customer ID
        const user = await this.prisma.user.findFirst({
          where: {
            lemonSqueezyCustomerId:
              event.data.attributes.customer_id.toString(),
          },
        });
        console.log('userrrrrrrrrrrr by customerId in webook', user);
        if (user) {
          userId = user.id;
          this.logger.log(
            `Found user ${userId} by customer ID ${event.data.attributes.customer_id}`,
          );
        }
      }

      // Try to extract from order custom data if available
      if (!userId && event.data.attributes.order_id) {
        this.logger.log('Attempting to find user through order data');
        // You might need to implement order lookup if needed
      }

      if (!userId) {
        if (!userId) {
          this.logger.error(
            'Unable to determine userId from webhook. Subscription processing aborted.',
          );
          return;
        }
      }

      this.logger.log(`Processing subscription for user: ${userId}`);

      const variantId = event.data.attributes.variant_id;
      const productId = event.data.attributes.product_id;

      // Determine plan based on variant ID
      const plan = this.getPlanFromVariantId(variantId.toString());
      this.logger.log(`Plannnnnnnnnnnnnnnnnnnnnnnn to give user: ${userId}`);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lemonSqueezySubscriptionId: event.data.id.toString(),
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          subscriptionStatus: event.data.attributes.status,
          plan,
          currentPeriodStart: new Date(event.data.attributes.renews_at),
          currentPeriodEnd: new Date(event.data.attributes.ends_at),
          trialEndsAt: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: event.data.attributes.cancelled,
        },
      });

      // Create or update subscription record
      await this.prisma.subscription.upsert({
        where: {
          lemonSqueezySubscriptionId: event.data.id.toString(),
        },
        create: {
          userId,
          lemonSqueezySubscriptionId: event.data.id.toString(),
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          status: event.data.attributes.status,
          currentPeriodStart: new Date(event.data.attributes.renews_at),
          currentPeriodEnd: new Date(event.data.attributes.ends_at),
          trialStart: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.created_at)
            : null,
          trialEnd: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: event.data.attributes.cancelled,
        },
        update: {
          status: event.data.attributes.status,
          currentPeriodStart: new Date(event.data.attributes.renews_at),
          currentPeriodEnd: new Date(event.data.attributes.ends_at),
          trialStart: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.created_at)
            : null,
          trialEnd: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: event.data.attributes.cancelled,
        },
      });

      this.logger.log(
        `Subscription ${event.data.id} created for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription created: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription updated webhook
   */
  async handleSubscriptionUpdated(event: any): Promise<void> {
    try {
      // Extract user_id from event.meta.custom_data.user_id as corrected by user
      let userId = event.meta?.custom_data?.user_id;
      
      // If not found in meta.custom_data, try other locations as fallback
      if (!userId) {
        userId = event.data?.attributes?.custom_data?.user_id;
      }

      if (!userId) {
        // Try to find user by subscription ID
        const user = await this.prisma.user.findFirst({
          where: { lemonSqueezySubscriptionId: event.data.id.toString() },
        });
        if (!user) {
          this.logger.warn(`No user found for subscription ${event.data.id}`);
          return;
        }
        userId = user.id;
      }

      const variantId = event.data.attributes.variant_id;
      const productId = event.data.attributes.product_id;
      const plan = this.getPlanFromVariantId(variantId.toString());

      await this.prisma.user.updateMany({
        where: { lemonSqueezySubscriptionId: event.data.id.toString() },
        data: {
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          subscriptionStatus: event.data.attributes.status,
          plan,
          currentPeriodStart: new Date(event.data.attributes.renews_at),
          currentPeriodEnd: new Date(event.data.attributes.ends_at),
          trialEndsAt: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: event.data.attributes.cancelled,
        },
      });

      // Update subscription record
      await this.prisma.subscription.updateMany({
        where: { lemonSqueezySubscriptionId: event.data.id.toString() },
        data: {
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          status: event.data.attributes.status,
          currentPeriodStart: new Date(event.data.attributes.renews_at),
          currentPeriodEnd: new Date(event.data.attributes.ends_at),
          trialEnd: event.data.attributes.trial_ends_at
            ? new Date(event.data.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: event.data.attributes.cancelled,
          canceledAt: event.data.attributes.cancelled ? new Date() : null,
        },
      });

      this.logger.log(`Subscription ${event.data.id} updated`);
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription updated: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Handle subscription deleted webhook
   */
  async handleSubscriptionDeleted(event: any): Promise<void> {
    try {
      // Extract user_id from event.meta.custom_data.user_id as corrected by user
      let userId = event.meta?.custom_data?.user_id;
      
      // If not found in meta.custom_data, try other locations as fallback
      if (!userId) {
        userId = event.data?.attributes?.custom_data?.user_id;
      }

      // Log user_id for debugging
      this.logger.log(`Processing subscription deletion for user: ${userId}`);

      await this.prisma.user.updateMany({
        where: { lemonSqueezySubscriptionId: event.data.id.toString() },
        data: {
          subscriptionStatus: 'canceled',
          plan: 'free',
          cancelAtPeriodEnd: false,
        },
      });

      await this.prisma.subscription.updateMany({
        where: { lemonSqueezySubscriptionId: event.data.id.toString() },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
        },
      });

      this.logger.log(`Subscription ${event.data.id} deleted`);
    } catch (error) {
      this.logger.error(
        `Failed to handle subscription deleted: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;

    // Removed excessive logging

    // Check if user has active subscription
    if (
      ['active', 'trialing', 'on_trial'].includes(user.subscriptionStatus || '')
    ) {
      return true;
    }

    // Check if trial is still valid
    if (user.trialEndsAt && user.trialEndsAt > new Date()) {
      return true;
    }

    // Check if subscription is still within current period (even if cancelled)
    if (
      user.currentPeriodEnd &&
      user.currentPeriodEnd > new Date() &&
      !user.cancelAtPeriodEnd
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get subscription status for user
   */
  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isActive = await this.hasActiveSubscription(userId);
    const now = new Date();

    // Calculate days until trial ends
    const daysUntilTrialEnd = user.trialEndsAt
      ? Math.ceil(
          (user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    // Calculate days until subscription ends
    const daysUntilSubscriptionEnd = user.currentPeriodEnd
      ? Math.ceil(
          (user.currentPeriodEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    // Get the latest subscription record for detailed info
    const latestSubscription = user.subscriptions[0];
    const subscriptionDaysRemaining = latestSubscription?.currentPeriodEnd
      ? Math.ceil(
          (latestSubscription.currentPeriodEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      plan: user.plan,
      status: user.subscriptionStatus,
      isActive,
      trialEndsAt: user.trialEndsAt,
      daysUntilTrialEnd,
      currentPeriodEnd: user.currentPeriodEnd,
      daysUntilSubscriptionEnd,
      subscriptionDaysRemaining,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      lemonSqueezyCustomerId: user.lemonSqueezyCustomerId,
      lemonSqueezySubscriptionId: user.lemonSqueezySubscriptionId,
      subscription: latestSubscription,
    };
  }

  /**
   * Get detailed subscription information with usage limits
   */
  async getDetailedSubscriptionInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        usageRecords: {
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // This month
            },
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const now = new Date();
    const subscription = user.subscriptions[0];

    // Calculate remaining days
    let daysRemaining: number | null = null;
    let expiresAt: Date | null = null;

    if (user.trialEndsAt && user.trialEndsAt > now) {
      // User is on trial
      daysRemaining = Math.ceil(
        (user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expiresAt = user.trialEndsAt;
    } else if (user.currentPeriodEnd && user.currentPeriodEnd > now) {
      // User has active subscription
      daysRemaining = Math.ceil(
        (user.currentPeriodEnd.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expiresAt = user.currentPeriodEnd;
    }

    // Calculate usage for this month
    const monthlyUsage = user.usageRecords.reduce(
      (acc, record) => {
        acc[record.feature] = (acc[record.feature] || 0) + record.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Define plan limits
    const planLimits = {
      free: { pii_detection: 3, documents: 5 },
      solo: { pii_detection: 100, documents: 50 },
      firm: { pii_detection: 500, documents: 200 },
      enterprise: { pii_detection: -1, documents: -1 }, // Unlimited
    };

    const limits =
      planLimits[user.plan as keyof typeof planLimits] || planLimits.free;

    return {
      plan: user.plan,
      status: user.subscriptionStatus,
      isActive: await this.hasActiveSubscription(userId),
      daysRemaining,
      expiresAt,
      subscription,
      usage: monthlyUsage,
      limits,
      remainingUsage: {
        pii_detection:
          limits.pii_detection === -1
            ? -1
            : Math.max(
                0,
                limits.pii_detection - (monthlyUsage.pii_detection || 0),
              ),
        documents:
          limits.documents === -1
            ? -1
            : Math.max(0, limits.documents - (monthlyUsage.documents || 0)),
      },
    };
  }

  /**
   * Track usage for a feature
   */
  async trackUsage(
    userId: string,
    feature: string,
    count: number = 1,
    metadata?: any,
  ): Promise<void> {
    try {
      await this.prisma.usageRecord.create({
        data: {
          userId,
          feature,
          count,
          metadata: metadata || {},
        },
      });

      this.logger.log(`Tracked usage: ${feature} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to track usage: ${error.message}`);
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const records = await this.prisma.usageRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const stats = records.reduce(
      (acc, record) => {
        if (!acc[record.feature]) {
          acc[record.feature] = 0;
        }
        acc[record.feature] += record.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: records.reduce((sum, r) => sum + r.count, 0),
      byFeature: stats,
      records: records.slice(0, 50), // Last 50 records
    };
  }

  /**
   * Helper to determine plan from variant ID
   */
  private getPlanFromVariantId(variantId: string): string {
    // You'll need to set these in your environment or config
    const SOLO_VARIANT_ID = this.configService.get<string>(
      'LEMONSQUEEZY_SOLO_VARIANT_ID',
    );
    const FIRM_VARIANT_ID = this.configService.get<string>(
      'LEMONSQUEEZY_FIRM_VARIANT_ID',
    );
    const ENTERPRISE_VARIANT_ID = this.configService.get<string>(
      'LEMONSQUEEZY_ENTERPRISE_VARIANT_ID',
    );

    if (variantId === SOLO_VARIANT_ID) return 'solo';
    if (variantId === FIRM_VARIANT_ID) return 'firm';
    if (variantId === ENTERPRISE_VARIANT_ID) return 'enterprise';

    return 'free';
  }

  /**
   * Verify webhook signature from LemonSqueezy
   */
  verifyWebhookSignature(payload: Buffer, signature: string): any {
    const webhookSecret = this.configService.get<string>(
      'LEMONSQUEEZY_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
    }

    // LemonSqueezy uses HMAC SHA256 for webhook verification
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }

    return JSON.parse(payload.toString());
  }

  /**
   * Manually activate trial for a user (for testing/debugging)
   */
  async activateManualTrial(userId: string): Promise<any> {
    try {
      // Check if user already has a trial or subscription
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.subscriptionStatus && user.subscriptionStatus !== 'free') {
        return {
          success: false,
          message: 'User already has an active subscription or trial',
          currentStatus: user.subscriptionStatus,
        };
      }

      // Activate 14-day trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'trialing',
          plan: 'solo', // Default trial plan
          trialEndsAt: trialEndDate,
        },
      });

      return {
        success: true,
        message: 'Trial activated successfully',
        trialEndsAt: trialEndDate,
      };
    } catch (error) {
      this.logger.error(`Failed to activate manual trial: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manually sync subscription from LemonSqueezy (for testing/debugging)
   */
  async syncSubscriptionFromLemonSqueezy(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (!user.lemonSqueezySubscriptionId) {
        return {
          success: false,
          message: 'No LemonSqueezy subscription ID found for user',
        };
      }

      // Fetch subscription from LemonSqueezy API
      const response = await axios.get(
        `${this.apiUrl}/subscriptions/${user.lemonSqueezySubscriptionId}`,
        { headers: this.getHeaders() },
      );

      const subscription = response.data.data;
      this.logger.log(
        `Syncing subscription ${subscription.id} for user ${userId}`,
      );

      // Update user with latest subscription data
      const variantId = subscription.attributes.variant_id;
      const productId = subscription.attributes.product_id;
      const plan = this.getPlanFromVariantId(variantId.toString());

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          subscriptionStatus: subscription.attributes.status,
          plan,
          currentPeriodStart: new Date(subscription.attributes.renews_at),
          currentPeriodEnd: new Date(subscription.attributes.ends_at),
          trialEndsAt: subscription.attributes.trial_ends_at
            ? new Date(subscription.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: subscription.attributes.cancelled,
        },
      });

      // Update or create subscription record
      await this.prisma.subscription.upsert({
        where: { lemonSqueezySubscriptionId: subscription.id.toString() },
        create: {
          userId,
          lemonSqueezySubscriptionId: subscription.id.toString(),
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          status: subscription.attributes.status,
          currentPeriodStart: new Date(subscription.attributes.renews_at),
          currentPeriodEnd: new Date(subscription.attributes.ends_at),
          trialStart: subscription.attributes.trial_ends_at
            ? new Date(subscription.attributes.created_at)
            : null,
          trialEnd: subscription.attributes.trial_ends_at
            ? new Date(subscription.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: subscription.attributes.cancelled,
        },
        update: {
          lemonSqueezyVariantId: variantId.toString(),
          lemonSqueezyProductId: productId.toString(),
          status: subscription.attributes.status,
          currentPeriodStart: new Date(subscription.attributes.renews_at),
          currentPeriodEnd: new Date(subscription.attributes.ends_at),
          trialEnd: subscription.attributes.trial_ends_at
            ? new Date(subscription.attributes.trial_ends_at)
            : null,
          cancelAtPeriodEnd: subscription.attributes.cancelled,
          canceledAt: subscription.attributes.cancelled ? new Date() : null,
        },
      });

      return {
        success: true,
        message: 'Subscription synced successfully',
        subscription: {
          id: subscription.id,
          status: subscription.attributes.status,
          plan,
          trialEndsAt: subscription.attributes.trial_ends_at,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to sync subscription: ${error.message}`);
      throw error;
    }
  }
}
