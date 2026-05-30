import { Controller, Post, Body, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req: any, @Body() body: any) {
    return this.authService.changePassword(req.user.userID, body.oldPassword, body.newPassword);
  }

  @Post('reset-password/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async resetPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ) {
    return this.authService.resetPassword(userId, req.user);
  }
}
