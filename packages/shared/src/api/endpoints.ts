import { get, post, put, patch, del } from './client';
import type { 
  ApiResponse, 
  PaginatedResponse,
  ChatMessageWithProfile,
  ForumThreadWithProfile,
  ForumReplyWithProfile,
  VehicleWithNotes,
  ProductWithVendor,
  GarageWithMembership,
  ReportWithDetails,
  VinDecodeResult,
  PartSearchResult,
} from '../types/api';
import type { 
  Profile, 
  Garage, 
  Vehicle, 
  VehicleNote, 
  Product,
} from '../types/database';
import type {
  UpdateProfileInput,
  JoinGarageInput,
  CreateChatMessageInput,
  CreateForumThreadInput,
  UpdateForumThreadInput,
  CreateForumReplyInput,
  CreateVehicleInput,
  UpdateVehicleInput,
  CreateVehicleNoteInput,
  UpdateVehicleNoteInput,
  CreateProductInput,
  CreateReportInput,
  BlockUserInput,
} from '../validators';

export const profileApi = {
  getMe: () => get<Profile>('/api/profile/me'),
  getById: (id: string) => get<Profile>(`/api/profile/${id}`),
  update: (data: UpdateProfileInput) => patch<Profile>('/api/profile/me', data),
};

export const garageApi = {
  list: () => get<GarageWithMembership[]>('/api/garages'),
  getById: (id: string) => get<GarageWithMembership>(`/api/garages/${id}`),
  join: (data: JoinGarageInput) => post<void>('/api/garages/join', data),
  leave: (garageId: string) => del<void>(`/api/garages/${garageId}/leave`),
  getMembers: (garageId: string, page?: number) => 
    get<PaginatedResponse<Profile>>(`/api/garages/${garageId}/members?page=${page || 1}`),
};

export const chatApi = {
  getMessages: (garageId: string, limit?: number, before?: string) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (before) params.set('before', before);
    return get<ChatMessageWithProfile[]>(`/api/garages/${garageId}/chat?${params}`);
  },
  sendMessage: (data: CreateChatMessageInput) => 
    post<ChatMessageWithProfile>(`/api/garages/${data.garage_id}/chat`, { content: data.content }),
  deleteMessage: (garageId: string, messageId: string) => 
    del<void>(`/api/garages/${garageId}/chat/${messageId}`),
};

export const forumApi = {
  getThreads: (garageId: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    return get<PaginatedResponse<ForumThreadWithProfile>>(`/api/garages/${garageId}/forum?${params}`);
  },
  getThread: (garageId: string, threadId: string) => 
    get<ForumThreadWithProfile>(`/api/garages/${garageId}/forum/${threadId}`),
  createThread: (data: CreateForumThreadInput) => 
    post<ForumThreadWithProfile>(`/api/garages/${data.garage_id}/forum`, data),
  updateThread: (garageId: string, threadId: string, data: UpdateForumThreadInput) => 
    patch<ForumThreadWithProfile>(`/api/garages/${garageId}/forum/${threadId}`, data),
  deleteThread: (garageId: string, threadId: string) => 
    del<void>(`/api/garages/${garageId}/forum/${threadId}`),
  getReplies: (garageId: string, threadId: string, page?: number) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    return get<PaginatedResponse<ForumReplyWithProfile>>(
      `/api/garages/${garageId}/forum/${threadId}/replies?${params}`
    );
  },
  createReply: (garageId: string, threadId: string, data: Pick<CreateForumReplyInput, 'content'>) => 
    post<ForumReplyWithProfile>(`/api/garages/${garageId}/forum/${threadId}/replies`, data),
  deleteReply: (garageId: string, threadId: string, replyId: string) => 
    del<void>(`/api/garages/${garageId}/forum/${threadId}/replies/${replyId}`),
};

export const vehicleApi = {
  list: () => get<VehicleWithNotes[]>('/api/vehicles'),
  getById: (id: string) => get<VehicleWithNotes>(`/api/vehicles/${id}`),
  create: (data: CreateVehicleInput) => post<Vehicle>('/api/vehicles', data),
  update: (id: string, data: UpdateVehicleInput) => patch<Vehicle>(`/api/vehicles/${id}`, data),
  delete: (id: string) => del<void>(`/api/vehicles/${id}`),
  getNotes: (vehicleId: string) => get<VehicleNote[]>(`/api/vehicles/${vehicleId}/notes`),
  createNote: (vehicleId: string, data: Omit<CreateVehicleNoteInput, 'vehicle_id'>) => 
    post<VehicleNote>(`/api/vehicles/${vehicleId}/notes`, data),
  updateNote: (vehicleId: string, noteId: string, data: UpdateVehicleNoteInput) => 
    patch<VehicleNote>(`/api/vehicles/${vehicleId}/notes/${noteId}`, data),
  deleteNote: (vehicleId: string, noteId: string) => 
    del<void>(`/api/vehicles/${vehicleId}/notes/${noteId}`),
};

export const productApi = {
  list: (category?: string, page?: number) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (page) params.set('page', String(page));
    return get<PaginatedResponse<ProductWithVendor>>(`/api/products?${params}`);
  },
  getById: (id: string) => get<ProductWithVendor>(`/api/products/${id}`),
  submit: (data: CreateProductInput) => post<Product>('/api/products', data),
  getMySubmissions: () => get<Product[]>('/api/products/my-submissions'),
};

export const adminApi = {
  getPendingProducts: (page?: number) => 
    get<PaginatedResponse<ProductWithVendor>>(`/api/admin/products/pending?page=${page || 1}`),
  approveProduct: (productId: string) => 
    post<Product>(`/api/admin/products/${productId}/approve`),
  rejectProduct: (productId: string, reason?: string) => 
    post<Product>(`/api/admin/products/${productId}/reject`, { reason }),
  getPendingReports: (page?: number) => 
    get<PaginatedResponse<ReportWithDetails>>(`/api/admin/reports?page=${page || 1}`),
  reviewReport: (reportId: string, status: string, action?: string) => 
    post<void>(`/api/admin/reports/${reportId}/review`, { status, action_taken: action }),
  banUser: (userId: string, duration?: string, reason?: string) => 
    post<void>(`/api/admin/users/${userId}/ban`, { duration, reason }),
  unbanUser: (userId: string) => 
    post<void>(`/api/admin/users/${userId}/unban`),
  promoteToVendor: (userId: string) => 
    post<void>(`/api/admin/users/${userId}/promote-vendor`),
};

export const reportApi = {
  create: (data: CreateReportInput) => post<void>('/api/reports', data),
  getMyReports: () => get<ReportWithDetails[]>('/api/reports/mine'),
};

export const blockApi = {
  block: (data: BlockUserInput) => post<void>('/api/blocks', data),
  unblock: (userId: string) => del<void>(`/api/blocks/${userId}`),
  getBlocked: () => get<Profile[]>('/api/blocks'),
};

export const partsApi = {
  decodeVin: (vin: string) => get<VinDecodeResult>(`/api/parts/vin/${vin}`),
  search: (query: string, vehicleId?: string) => {
    const params = new URLSearchParams({ q: query });
    if (vehicleId) params.set('vehicle_id', vehicleId);
    return get<PartSearchResult[]>(`/api/parts/search?${params}`);
  },
};
