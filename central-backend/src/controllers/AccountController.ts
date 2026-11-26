import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { AccountEntry, AccountEntryType, AccountHead, PartyType } from '../models';

@Route('api/v1/accounts')
@Tags('Accounts')
export class AccountController extends Controller {
  @Get('heads')
  @Security('tenantHeader')
  public async heads(@Query() tenantId: string): Promise<AccountHead[]> {
    return erpService.listAccountHeads(tenantId);
  }

  @Post('heads')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertHead(
    @Query() tenantId: string,
    @Body() body: { id?: string; name: string; groupName: string; nature?: string; openingBalance?: number; isActive?: boolean },
  ): Promise<AccountHead> {
    this.setStatus(201);
    return erpService.upsertAccountHead(tenantId, body);
  }

  @Get('entries')
  @Security('tenantHeader')
  public async entries(@Query() tenantId: string, @Query() partyType?: PartyType): Promise<AccountEntry[]> {
    return erpService.listAccountEntries(tenantId, partyType);
  }

  @Post('entries')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async createEntry(
    @Query() tenantId: string,
    @Body()
    body: {
      entryType: AccountEntryType;
      accountHeadId?: string;
      partyType?: PartyType;
      partyId?: string;
      partyName?: string;
      entryDate: string;
      amount: number;
      paymentMode?: string;
      narration?: string;
      referenceNo?: string;
    },
  ): Promise<AccountEntry> {
    this.setStatus(201);
    return erpService.createAccountEntry(tenantId, body);
  }
}
