import { handleMedia } from './handler.ts';
Deno.serve(request => handleMedia(request));
