/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

export type WriteIndividualCodeDto = {
  code: string;
  status: 'NEW' | 'USED';
  productId: string;
  boxesCodeId?: number;
  shiftId?: string;
};
