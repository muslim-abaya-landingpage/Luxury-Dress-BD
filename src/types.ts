export interface Product {
  id: string;
  nameEn: string;
  nameBn: string;
  price: number;
  originalPrice: number;
  discountBadge?: string;
  image: string;
  fabricEn: string;
  fabricBn: string;
  descriptionEn: string;
  descriptionBn: string;
  colors: { name: string; class: string }[];
  sizes: string[];
  featuresEn: string[];
  featuresBn: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
}

export interface OrderDetails {
  name: string;
  phone: string;
  address: string;
  city: string; // Dhaka or Outside Dhaka
  notes?: string;
}

export interface VideoItem {
  id: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  youtubeId: string;
  thumbnail: string;
}

export interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  date: string;
  textEn: string;
  textBn: string;
  verified: boolean;
}
