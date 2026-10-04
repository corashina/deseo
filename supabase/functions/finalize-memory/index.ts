import { handleFinalize } from './handler.ts';
Deno.serve(request => handleFinalize(request));
