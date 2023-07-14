export function businessUnitKeyFormatter(companyName: string): string {
  const normalizedCompanyName = companyNameNormalizer(companyName);
  return `business_unit_${normalizedCompanyName}`;
}

export function companyNameNormalizer(companyName: string): string {
  return companyName.toLowerCase().replace(/ /g, '_');
}
