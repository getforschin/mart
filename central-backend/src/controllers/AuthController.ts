import { Body, Controller, Post, Route, SuccessResponse, Tags } from 'tsoa';
import { erpService } from '../core/services/erp.service';

interface LoginBody {
  username: string;
  password: string;
}

@Route('api/v1/auth')
@Tags('Auth')
export class AuthController extends Controller {
  @Post('login')
  @SuccessResponse(200, 'Logged in')
  public async login(@Body() body: LoginBody): Promise<{
    token: string;
    user: { id: string; email: string; username: string | null; fullName: string; role: string; tenantId: string };
  }> {
    try {
      const result = await erpService.login(body.username, body.password);
      this.setStatus(200);
      return result;
    } catch (error) {
      this.setStatus(401);
      throw error;
    }
  }
}
