import { Body, Controller, Get, Post, Query, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';
import { Expense, ExpenseCategory, ExpenseSchedule } from '../models';

@Route('api/v1/expenses')
@Tags('Expenses')
export class ExpenseController extends Controller {
  @Get()
  @Security('tenantHeader')
  public async list(
    @Query() tenantId: string,
    @Query() from?: string,
    @Query() to?: string,
  ): Promise<Expense[]> {
    return erpService.listExpenses(tenantId, from, to);
  }

  @Post()
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async create(
    @Query() tenantId: string,
    @Body()
    body: {
      facilityId?: string;
      expenseDate: string;
      amount: number;
      purpose: string;
      category?: ExpenseCategory;
      paymentMode?: string;
      payee?: string;
      notes?: string;
      createdBy?: string;
    },
  ): Promise<Expense> {
    this.setStatus(201);
    return erpService.createExpense(tenantId, body);
  }

  @Get('schedules')
  @Security('tenantHeader')
  public async listSchedules(@Query() tenantId: string): Promise<ExpenseSchedule[]> {
    return erpService.listExpenseSchedules(tenantId);
  }

  @Post('schedules')
  @Security('tenantHeader')
  @SuccessResponse(201, 'Created')
  public async upsertSchedule(
    @Query() tenantId: string,
    @Body()
    body: {
      id?: string;
      purpose: string;
      amount: number;
      dayOfMonth: number;
      category?: ExpenseCategory;
      paymentMode?: string;
      payee?: string;
      notes?: string;
      facilityId?: string;
      isActive?: boolean;
      startMonth?: string;
      endMonth?: string;
    },
  ): Promise<ExpenseSchedule> {
    this.setStatus(201);
    return erpService.upsertExpenseSchedule(tenantId, body);
  }

  @Post('run-schedules')
  @Security('tenantHeader')
  public async runSchedules(
    @Query() tenantId: string,
    @Query() asOf?: string,
  ): Promise<{ posted: Expense[] }> {
    return erpService.runExpenseSchedules(tenantId, asOf);
  }

  @Get('profit-loss')
  @Security('tenantHeader')
  public async profitLoss(
    @Query() tenantId: string,
    @Query() from: string,
    @Query() to: string,
  ): Promise<Record<string, unknown>> {
    return erpService.getProfitLoss(tenantId, from, to);
  }
}
