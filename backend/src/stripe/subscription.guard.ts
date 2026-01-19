import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LemonSqueezyService } from './stripe.service';

export const REQUIRED_PLAN = 'requiredPlan';

/**
 * Guard to check if user has required subscription plan
 * Usage: @RequirePlan('solo') or @RequirePlan(['solo', 'firm', 'enterprise'])
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private lemonSqueezyService: LemonSqueezyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.get<string | string[]>(REQUIRED_PLAN, context.getHandler());
    
    if (!requiredPlans) {
      return true; // No plan requirement
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasActiveSubscription = await this.lemonSqueezyService.hasActiveSubscription(userId);
    
    if (!hasActiveSubscription) {
      throw new ForbiddenException('Active subscription required. Please upgrade your plan.');
    }

    const status = await this.lemonSqueezyService.getSubscriptionStatus(userId);
    const userPlan = status.plan;

    const plans = Array.isArray(requiredPlans) ? requiredPlans : [requiredPlans];
    
    if (!plans.includes(userPlan)) {
      throw new ForbiddenException(`This feature requires ${plans.join(' or ')} plan`);
    }

    return true;
  }
}

/**
 * Decorator to specify required plan for a route
 */
export const RequirePlan = (plan: string | string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(REQUIRED_PLAN, plan, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(REQUIRED_PLAN, plan, target);
    return target;
  };
};
