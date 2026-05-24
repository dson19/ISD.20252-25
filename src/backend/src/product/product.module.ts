import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Book } from './entities/book.entity';
import { Newspaper } from './entities/newspaper.entity';
import { Cd } from './entities/cd.entity';
import { CdTrack } from './entities/cd-track.entity';
import { Dvd } from './entities/dvd.entity';
import { ProductRepository } from './product.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Book, Newspaper, Cd, CdTrack, Dvd]),
  ],
  controllers: [],
  providers: [ProductRepository],
  exports: [ProductRepository],
})
export class ProductsModule {}