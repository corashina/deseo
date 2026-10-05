import type { z } from 'zod';
import type { deviceSchema, permissionSchema } from './schema';
export type DeviceInput = z.infer<typeof deviceSchema>;
export type Permission = z.infer<typeof permissionSchema>;
