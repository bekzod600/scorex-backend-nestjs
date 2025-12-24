import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const exists = await this.usersService.findByEmail(email);
    if (exists) {
      throw new UnauthorizedException('Email already exists');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersService.createUser(email, hash, name);

    return this.signToken(user.id, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken(user.id, user.role);
  }

  private signToken(userId: string, role: string) {
    const payload: JwtPayload = {
      sub: userId,
      role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
