import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Book } from '../entities/book.entity';
import { Cd } from '../entities/cd.entity';
import { CdTrack } from '../entities/cd-track.entity';
import { Dvd } from '../entities/dvd.entity';
import { Newspaper } from '../entities/newspaper.entity';
import { Media } from '../entities/media.entity';
import { ProductTypeHandler } from '../interfaces/product-type-handler.interface';

@Injectable()
export class BookHandler implements ProductTypeHandler {
  readonly mediaType = 'BOOK';
  readonly detailKey = 'book';

  async findDetail(productId: number, dataSource: any): Promise<any> {
    return dataSource
      .getRepository(Book)
      .findOne({ where: { productID: productId }, relations: ['media'] });
  }

  async saveDetail(
    productId: number,
    dto: CreateProductDto | UpdateProductDto,
    manager: EntityManager,
  ): Promise<void> {
    if (!dto.book) {
      return;
    }

    const mediaRepo = manager.getRepository(Media);
    const savedMedia = await mediaRepo.save({
      productID: productId,
      publisher: dto.book.publisher,
      releaseDate: dto.book.publicationDate ? new Date(dto.book.publicationDate) : undefined,
      language: dto.book.language,
      genre: dto.book.genre,
    });

    await manager.getRepository(Book).save({
      productID: productId,
      media: savedMedia,
      authors: dto.book.authors,
      coverType: dto.book.coverType,
      numPages: dto.book.numPages,
    });
  }
}

@Injectable()
export class CdHandler implements ProductTypeHandler {
  readonly mediaType = 'CD';
  readonly detailKey = 'cd';

  async findDetail(productId: number, dataSource: any): Promise<any> {
    return dataSource.getRepository(Cd).findOne({
      where: { productID: productId },
      relations: ['media', 'tracks'],
    });
  }

  async saveDetail(
    productId: number,
    dto: CreateProductDto | UpdateProductDto,
    manager: EntityManager,
  ): Promise<void> {
    if (!dto.cd) {
      return;
    }

    const mediaRepo = manager.getRepository(Media);
    const savedMedia = await mediaRepo.save({
      productID: productId,
      publisher: dto.cd.recordLabel,
      releaseDate: dto.cd.releaseDate ? new Date(dto.cd.releaseDate) : undefined,
      genre: dto.cd.genre,
    });

    const { tracks, ...cdFields } = dto.cd;
    const cd = await manager.getRepository(Cd).save({
      productID: productId,
      media: savedMedia,
      artists: cdFields.artists,
    });

    if (tracks !== undefined) {
      await manager
        .getRepository(CdTrack)
        .createQueryBuilder()
        .delete()
        .where('product_id = :productID', { productID: productId })
        .execute();
    }

    if (tracks) {
      await manager.getRepository(CdTrack).save(
        tracks.map((track) => ({
          ...track,
          cd,
        })),
      );
    }
  }
}

@Injectable()
export class DvdHandler implements ProductTypeHandler {
  readonly mediaType = 'DVD';
  readonly detailKey = 'dvd';

  async findDetail(productId: number, dataSource: any): Promise<any> {
    return dataSource
      .getRepository(Dvd)
      .findOne({ where: { productID: productId }, relations: ['media'] });
  }

  async saveDetail(
    productId: number,
    dto: CreateProductDto | UpdateProductDto,
    manager: EntityManager,
  ): Promise<void> {
    if (!dto.dvd) {
      return;
    }

    const mediaRepo = manager.getRepository(Media);
    const savedMedia = await mediaRepo.save({
      productID: productId,
      publisher: dto.dvd.studio,
      releaseDate: dto.dvd.releaseDate ? new Date(dto.dvd.releaseDate) : undefined,
      language: dto.dvd.language,
      genre: dto.dvd.genre,
    });

    await manager.getRepository(Dvd).save({
      productID: productId,
      media: savedMedia,
      discType: dto.dvd.discType,
      director: dto.dvd.director,
      runtimeMinutes: dto.dvd.runtimeMinutes,
      subtitles: dto.dvd.subtitles,
    });
  }
}

@Injectable()
export class NewspaperHandler implements ProductTypeHandler {
  readonly mediaType = 'NEWSPAPER';
  readonly detailKey = 'newspaper';

  async findDetail(productId: number, dataSource: any): Promise<any> {
    return dataSource
      .getRepository(Newspaper)
      .findOne({ where: { productID: productId }, relations: ['media'] });
  }

  async saveDetail(
    productId: number,
    dto: CreateProductDto | UpdateProductDto,
    manager: EntityManager,
  ): Promise<void> {
    if (!dto.newspaper) {
      return;
    }

    const mediaRepo = manager.getRepository(Media);
    const savedMedia = await mediaRepo.save({
      productID: productId,
      publisher: dto.newspaper.publisher,
      releaseDate: dto.newspaper.publicationDate ? new Date(dto.newspaper.publicationDate) : undefined,
      language: dto.newspaper.language,
    });

    await manager.getRepository(Newspaper).save({
      productID: productId,
      media: savedMedia,
      editorInChief: dto.newspaper.editorInChief,
      issueNumber: dto.newspaper.issueNumber,
      frequency: dto.newspaper.frequency,
      issn: dto.newspaper.issn,
      sections: dto.newspaper.sections,
    });
  }
}
