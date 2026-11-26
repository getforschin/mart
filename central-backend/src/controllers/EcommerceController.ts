import { Body, Controller, Get, Path, Post, Put, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { Coupon, EcommerceOrder, EcommerceOrderStatus, PaymentChannel } from '../models';

@Route('api/v1/ecommerce')
@Tags('Ecommerce')
export class EcommerceController extends Controller {
  @Get('coupons')
  @Security('tenantHeader')
  public async coupons(@Query() tenantId: string): Promise<Coupon[]> {
    return erpService.listCoupons(tenantId);
  }

  @Post('coupons')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertCoupon(
    @Query() tenantId: string,
    @Body()
    body: {
      id?: string;
      code: string;
      title: string;
      percentOff?: number;
      flatOff?: number;
      minOrderAmount?: number;
      validFrom?: string;
      validTo?: string;
      isActive?: boolean;
    },
  ): Promise<Coupon> {
    this.setStatus(201);
    return erpService.upsertCoupon(tenantId, body);
  }

  @Get('orders')
  @Security('tenantHeader')
  public async orders(@Query() tenantId: string): Promise<EcommerceOrder[]> {
    return erpService.listEcommerceOrders(tenantId);
  }

  @Post('orders')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async placeOrder(
    @Query() tenantId: string,
    @Body()
    body: {
      customerId?: string;
      customerName: string;
      customerMobile: string;
      shippingAddress: string;
      pincode?: string;
      couponCode?: string;
      paymentChannel?: PaymentChannel;
      items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>;
    },
  ): Promise<EcommerceOrder> {
    this.setStatus(201);
    return erpService.placeEcommerceOrder(tenantId, body);
  }

  @Put('orders/{orderId}/status')
  @Security('tenantHeader')
  public async updateStatus(
    @Query() tenantId: string,
    @Path() orderId: string,
    @Body() body: { status: EcommerceOrderStatus },
  ): Promise<EcommerceOrder> {
    return erpService.updateEcommerceOrderStatus(tenantId, orderId, body.status);
  }
}
