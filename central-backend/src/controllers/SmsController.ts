import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { SmsChannel, SmsMessage } from '../models';

@Route('api/v1/sms')
@Tags('SMS')
export class SmsController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(@Query() tenantId: string): Promise<SmsMessage[]> {
    return erpService.listSms(tenantId);
  }

  @Post('send')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Sent')
  public async send(
    @Query() tenantId: string,
    @Body() body: { channel: SmsChannel; mobile: string; message: string; templateName?: string },
  ): Promise<SmsMessage> {
    this.setStatus(201);
    return erpService.sendSms(tenantId, body);
  }
}
