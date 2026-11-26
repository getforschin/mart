import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TenantThemeVariables {
  @IsString()
  primaryColor!: string;

  @IsString()
  secondaryColor!: string;

  @IsString()
  accentColor!: string;

  @IsString()
  logoUrl!: string;

  @IsString()
  fontFamily!: string;
}

export class TenantTaxParameters {
  @IsString()
  regionCode!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  standardVatRate!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  reducedVatRate!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  gstRate!: number;

  @IsBoolean()
  pricesIncludeTax!: boolean;

  @IsString()
  currencyCode!: string;
}

export class TenantFeatureFlags {
  @IsBoolean()
  enableLotTracking!: boolean;

  @IsBoolean()
  enableOfflinePos!: boolean;

  @IsBoolean()
  enableWebStorefront!: boolean;

  @IsBoolean()
  enableExpiryAlerts!: boolean;

  @IsBoolean()
  enableBiometricAttendance!: boolean;

  @IsBoolean()
  enableMultiMrpSelection!: boolean;
}

export class TenantMetadataSchema {
  theme!: TenantThemeVariables;
  taxParameters!: TenantTaxParameters;
  featureFlags!: TenantFeatureFlags;

  @IsOptional()
  @IsString()
  customDomain?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
}

export interface CustomerPayload {
  name: string;
  phone?: string;
  email?: string;
  loyaltyId?: string;
  billingAddress?: string;
}
