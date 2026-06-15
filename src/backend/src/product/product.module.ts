import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Media } from './entities/media.entity';
import { Book } from './entities/book.entity';
import { Newspaper } from './entities/newspaper.entity';
import { Cd } from './entities/cd.entity';
import { CdTrack } from './entities/cd-track.entity';
import { Dvd } from './entities/dvd.entity';
import { ProductLog } from './entities/product-audit-log.entity';
import { ProductController } from './product.controller';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { ProductValidatorFactory } from './validators/product-validator.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Media,
      Book,
      Newspaper,
      Cd,
      CdTrack,
      Dvd,
      ProductLog,
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductRepository, ProductService, ProductValidatorFactory],
  exports: [ProductRepository, ProductService],
})
export class ProductsModule {}
