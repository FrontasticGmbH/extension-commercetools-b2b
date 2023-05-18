import { Category as DomainCategory } from '@Types/product/Category';

export interface Category extends DomainCategory {
  subCategories?: Category[];
  path?: string;
}
