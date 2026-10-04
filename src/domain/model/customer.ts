export interface Customer {
  id: string;
  name: string;
  kind: "home" | "business";
  phone: string;
  email: string;
  owner_id: string | null;
}
