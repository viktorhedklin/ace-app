import { base44 } from "./base44Client.js";

// LLM calls are handled by Claude API — not Base44
export { InvokeLLM } from './claude.js';

// Base44 backend integrations — active when connected to a Base44 app
export const SendEmail                 = (...args) => base44.integrations.SendEmail(...args);
export const UploadFile                = (...args) => base44.integrations.UploadFile(...args);
export const GenerateImage             = (...args) => base44.integrations.GenerateImage(...args);
export const ExtractDataFromUploadedFile = (...args) => base44.integrations.ExtractDataFromUploadedFile(...args);
export const CreateFileSignedUrl       = (...args) => base44.integrations.CreateFileSignedUrl(...args);
export const UploadPrivateFile         = (...args) => base44.integrations.UploadPrivateFile(...args);
