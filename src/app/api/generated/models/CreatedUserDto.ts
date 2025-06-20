/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreatedUserDto = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    picture: string | null;
    role: 'ADMIN' | 'SUPERVISOR' | 'USER' | 'GUEST';
    created: any;
    modified: any;
};

