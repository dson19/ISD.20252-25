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
import {
  ProductValidatorFactory,
  BookValidator,
  CdValidator,
  DvdValidator,
  NewspaperValidator,
} from './validators/product-validator.factory';
import { PRODUCT_VALIDATORS } from './interfaces/product-validator.interface';
import { BookHandler, CdHandler, DvdHandler, NewspaperHandler } from './handlers/concrete-handlers';
import { ProductTypeHandlerFactory } from './handlers/product-type-handler.factory';
import { PRODUCT_TYPE_HANDLERS } from './interfaces/product-type-handler.interface';

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
  providers: [
    ProductRepository,
    ProductService,
    ProductValidatorFactory,
    ProductTypeHandlerFactory,
    BookHandler,
    CdHandler,
    DvdHandler,
    NewspaperHandler,
    BookValidator,
    CdValidator,
    DvdValidator,
    NewspaperValidator,
    {
      provide: PRODUCT_TYPE_HANDLERS,
      useFactory: (book: BookHandler, cd: CdHandler, dvd: DvdHandler, newspaper: NewspaperHandler) => [book, cd, dvd, newspaper],
      inject: [BookHandler, CdHandler, DvdHandler, NewspaperHandler],
    },
    // OCP: validators discovered via token. Adding a product type = new validator + provider entry.
    {
      provide: PRODUCT_VALIDATORS,
      useFactory: (book: BookValidator, cd: CdValidator, dvd: DvdValidator, newspaper: NewspaperValidator) => [book, cd, dvd, newspaper],
      inject: [BookValidator, CdValidator, DvdValidator, NewspaperValidator],
    },
  ],
  exports: [ProductRepository, ProductService],
})
export class ProductsModule {}
