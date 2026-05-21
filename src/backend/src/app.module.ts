import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './product/product.module';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';


@Module({
  imports: [
    ConfigModule.forRoot(),
    ProductsModule,
    UserModule,
    OrderModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, ],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbHost = configService.get('DB_HOST');
        const isRemote = dbHost?.includes('supabase') || dbHost?.includes('.co');
        return {
          type: 'postgres',
          host: dbHost,
          port: parseInt(configService.get('DB_PORT', '5432'), 10),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          ssl: isRemote ? { rejectUnauthorized: false } : false
        };
      },
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
