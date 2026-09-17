export interface SignupPayload {
  name?: string;
  fullName?: string;
  email?: string;
  password?: string;
}

export interface LoginPayload {
  email?: string;
  password?: string;
}
