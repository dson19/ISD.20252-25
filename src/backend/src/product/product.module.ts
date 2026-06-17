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
import { BookHandler, CdHandler, DvdHandler, NewspaperHandler } from './handlers/concrete-handlers';
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
    BookHandler,
    CdHandler,
    DvdHandler,
    NewspaperHandler,
    {
      provide: PRODUCT_TYPE_HANDLERS,
      useFactory: (book: BookHandler, cd: CdHandler, dvd: DvdHandler, newspaper: NewspaperHandler) => [book, cd, dvd, newspaper],
      inject: [BookHandler, CdHandler, DvdHandler, NewspaperHandler],
    },
  ],
  exports: [ProductRepository, ProductService],
})
export class ProductsModule {}
