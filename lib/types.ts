export interface OutletVisit {
  date: string;
  notes?: string;
  salesperson?: string;
}

export interface Outlet {
  id: string;
  name: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  area?: string;
  beat: string;
  type: 'customer' | 'prospect';
  visitLog?: OutletVisit[];
  lastVisited?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
