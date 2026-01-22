/**
 * AI Image Generation Service
 * 
 * Provides image generation capabilities for sample data seeding using AI APIs
 * or placeholder fallback images.
 * 
 * All generated images use a professional yet cartoonish/illustrated style to
 * clearly indicate they are sample/demo content and not real photographs.
 * This helps distinguish sample data from actual production content.
 * 
 * Supported Providers:
 * - OpenAI DALL-E 3: Generates professional illustrated images (requires API key and costs apply)
 * - Placeholder: Generates simple colored rectangles with text (free, no API key needed)
 * 
 * @module imageGenerator
 * 
 * Environment Variables:
 * - AI_IMAGE_PROVIDER: 'openai' or 'placeholder' (default: 'placeholder')
 * - AI_IMAGE_API_KEY: OpenAI API key (required if provider is 'openai')
 */

import axios from 'axios';
import sharp from 'sharp';

// Configuration from environment variables
const AI_IMAGE_API_KEY = process.env.AI_IMAGE_API_KEY?.trim() || '';
const AI_IMAGE_PROVIDER = (process.env.AI_IMAGE_PROVIDER?.trim() || 'placeholder').toLowerCase();

// Constants
const MAX_PLACEHOLDER_TEXT_LENGTH = 50;
const MIN_NAME_LENGTH_FOR_INITIALS = 2;
const MAX_PROMPT_DESCRIPTION_LENGTH = 200;
const RATE_LIMIT_DELAY_MS = 1000; // Delay between API calls to avoid rate limiting
const OPENAI_API_TIMEOUT_MS = 60000; // 60 second timeout for image generation
const OPENAI_DOWNLOAD_TIMEOUT_MS = 30000; // 30 second timeout for image download

// Validate configuration on module load
if (AI_IMAGE_PROVIDER === 'openai' && !AI_IMAGE_API_KEY) {
  console.warn('[ImageGenerator] AI_IMAGE_PROVIDER is set to "openai" but AI_IMAGE_API_KEY is not configured. Falling back to placeholder images.');
}

interface ImageGenerationOptions {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

interface ImageGenerationResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Generate an image using OpenAI DALL-E 3
 * 
 * @param options - Image generation options including prompt, size, quality, and style
 * @returns Promise resolving to the generated image buffer and metadata
 * @throws Error if API key is not configured or API request fails
 */
async function generateImageWithOpenAI(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
  if (!AI_IMAGE_API_KEY) {
    throw new Error('AI_IMAGE_API_KEY environment variable is not set');
  }

  try {
    console.log('[ImageGenerator] Generating image with OpenAI DALL-E 3...');
    
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt: options.prompt,
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'natural',
        response_format: 'url',
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_IMAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: OPENAI_API_TIMEOUT_MS,
      }
    );

    const imageUrl = response.data.data[0].url;
    console.log('[ImageGenerator] Image generated, downloading...');
    
    // Download the generated image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: OPENAI_DOWNLOAD_TIMEOUT_MS,
    });

    const buffer = Buffer.from(imageResponse.data);
    
    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    
    console.log(`[ImageGenerator] Image downloaded: ${metadata.width}x${metadata.height}`);
    
    return {
      buffer,
      width: metadata.width || 1024,
      height: metadata.height || 1024,
      mimeType: 'image/png',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorData = (error as any)?.response?.data;
    
    // Log detailed error information for debugging
    if (errorData) {
      console.error('[ImageGenerator] OpenAI API error:', JSON.stringify(errorData, null, 2));
    } else {
      console.error('[ImageGenerator] OpenAI API error:', errorMessage);
    }
    
    throw new Error(`Failed to generate image with OpenAI: ${errorMessage}`);
  }
}

/**
 * Generate a placeholder image using Sharp (solid color with text)
 * 
 * Creates a simple colored rectangle with centered text overlay.
 * This is used when AI generation is not configured or as a fallback.
 * 
 * @param text - Text to display in the center of the image
 * @param width - Image width in pixels (default: 1024)
 * @param height - Image height in pixels (default: 1024)
 * @param backgroundColor - Hex color code for background (default: '#3b82f6')
 * @returns Promise resolving to the generated image buffer and metadata
 */
async function generatePlaceholderImage(
  text: string,
  width: number = 1024,
  height: number = 1024,
  backgroundColor: string = '#3b82f6'
): Promise<ImageGenerationResult> {
  // Ensure text is not empty and truncate to reasonable length
  const displayText = text ? text.substring(0, MAX_PLACEHOLDER_TEXT_LENGTH) : 'Image';
  
  // Calculate responsive font size based on image dimensions
  const fontSize = Math.max(24, Math.min(width, height) / 15);
  
  // Create a solid color SVG with centered text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="600"
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
        opacity="0.8"
      >
        ${displayText}
      </text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return {
    buffer,
    width,
    height,
    mimeType: 'image/png',
  };
}

/**
 * Generate an event photo based on a description
 * 
 * Creates a professional illustrated event image using AI or a placeholder fallback.
 * Images use a cartoonish/illustrated style to clearly indicate they are sample/demo content.
 * The style parameter controls the illustration style (professional, casual, or formal).
 * 
 * @param eventName - Name of the event (used for placeholder fallback)
 * @param eventDescription - Detailed description to guide AI generation
 * @param style - Illustration style: 'professional', 'casual', or 'formal' (default: 'professional')
 * @returns Promise resolving to the generated image buffer and metadata
 */
export async function generateEventPhoto(
  eventName: string,
  eventDescription: string,
  style: 'professional' | 'casual' | 'formal' = 'professional'
): Promise<ImageGenerationResult> {
  // Validate inputs
  if (!eventName?.trim()) {
    throw new Error('Event name is required for image generation');
  }
  
  if (!eventDescription?.trim()) {
    console.warn('[ImageGenerator] No event description provided, using event name only');
  }
  
  const stylePrompts = {
    professional: 'professional illustration, modern business conference setting, clean vector art style, vibrant colors',
    casual: 'warm illustrated scene, friendly gathering atmosphere, soft cartoon style, inviting colors',
    formal: 'elegant illustrated event, sophisticated corporate setting, refined digital art style, professional palette',
  };

  const description = eventDescription?.trim() || eventName;
  const prompt = `${stylePrompts[style]}, ${description.substring(0, MAX_PROMPT_DESCRIPTION_LENGTH)}, digital illustration, cartoon art style, professional yet clearly illustrated to indicate sample/demo content, vibrant and polished, no text or watermarks`;

  if (AI_IMAGE_PROVIDER === 'openai' && AI_IMAGE_API_KEY) {
    try {
      return await generateImageWithOpenAI({
        prompt,
        size: '1792x1024',
        quality: 'standard',
        style: 'vivid', // Use vivid for more illustrated, vibrant results
      });
    } catch (error) {
      console.warn('[ImageGenerator] Falling back to placeholder due to error:', error);
      return await generatePlaceholderImage(eventName, 1792, 1024);
    }
  }

  // Fallback to placeholder
  return await generatePlaceholderImage(eventName, 1792, 1024);
}

/**
 * Generate a profile picture for a person
 * 
 * Creates a professional avatar-style illustrated portrait using AI or a placeholder with initials.
 * Images are square format (1024x1024) optimized for profile pictures and avatars.
 * Uses a cartoonish/illustrated style to clearly indicate they are sample/demo content.
 * 
 * @param name - Full name of the person
 * @param jobTitle - Job title or professional role
 * @param gender - Optional gender hint for AI generation ('male', 'female', or undefined)
 * @returns Promise resolving to the generated image buffer and metadata
 */
export async function generateProfilePicture(
  name: string,
  jobTitle: string,
  gender?: 'male' | 'female'
): Promise<ImageGenerationResult> {
  // Validate inputs
  if (!name?.trim()) {
    throw new Error('Name is required for profile picture generation');
  }
  
  if (!jobTitle?.trim()) {
    console.warn('[ImageGenerator] No job title provided, using default');
    jobTitle = 'Professional';
  }
  
  const genderHint = gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person';
  
  // Prompt optimized for square avatar-style profile pictures
  const prompt = `professional avatar illustration of a ${genderHint}, ${jobTitle}, centered headshot composition, shoulders up, facing forward, clean solid color background, modern flat illustration style, friendly cartoon character, simple and clean design, professional business portrait, warm approachable expression, clearly illustrated to indicate sample/demo profile, vibrant colors, square avatar format, no text or watermarks, digital art`;

  /**
   * Helper function to extract initials from a name
   * Used for placeholder generation
   */
  const getInitials = (fullName: string): string => {
    if (!fullName || fullName.length < MIN_NAME_LENGTH_FOR_INITIALS) {
      return 'U'; // Default to 'U' for User if name is too short
    }
    
    return fullName
      .split(' ')
      .filter(part => part.length > 0) // Remove empty parts
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (AI_IMAGE_PROVIDER === 'openai' && AI_IMAGE_API_KEY) {
    try {
      return await generateImageWithOpenAI({
        prompt,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid', // Use vivid for more illustrated, vibrant results
      });
    } catch (error) {
      console.warn('[ImageGenerator] Falling back to placeholder due to error:', error);
      return await generatePlaceholderImage(getInitials(name), 400, 400, '#6366f1');
    }
  }

  // Fallback to placeholder with initials
  const initials = getInitials(name);
  
  return await generatePlaceholderImage(initials, 400, 400, '#6366f1');
}

/**
 * Check if AI image generation is configured and enabled
 * 
 * @returns true if OpenAI provider is configured with a valid API key, false otherwise
 */
export function isAIImageGenerationEnabled(): boolean {
  return AI_IMAGE_PROVIDER === 'openai' && !!AI_IMAGE_API_KEY;
}

/**
 * Get the current image generation provider name
 * 
 * @returns Human-readable name of the current provider
 */
export function getImageGenerationProvider(): string {
  if (isAIImageGenerationEnabled()) {
    return 'OpenAI DALL-E 3';
  }
  return 'Placeholder (AI not configured)';
}

/**
 * Get the configured rate limit delay in milliseconds
 * 
 * This delay should be used between consecutive API calls to avoid rate limiting.
 * 
 * @returns Rate limit delay in milliseconds
 */
export function getRateLimitDelay(): number {
  return RATE_LIMIT_DELAY_MS;
}

/**
 * Validate the image generation configuration
 * 
 * Checks if the environment variables are properly configured and logs warnings
 * if there are issues.
 * 
 * @returns Object containing validation results
 */
export function validateConfiguration(): {
  isValid: boolean;
  provider: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (AI_IMAGE_PROVIDER !== 'openai' && AI_IMAGE_PROVIDER !== 'placeholder') {
    warnings.push(`Unknown AI_IMAGE_PROVIDER: "${AI_IMAGE_PROVIDER}". Using placeholder mode.`);
  }
  
  if (AI_IMAGE_PROVIDER === 'openai' && !AI_IMAGE_API_KEY) {
    warnings.push('AI_IMAGE_PROVIDER is "openai" but AI_IMAGE_API_KEY is not set. Using placeholder mode.');
  }
  
  const isValid = warnings.length === 0 || AI_IMAGE_PROVIDER === 'placeholder';
  
  return {
    isValid,
    provider: getImageGenerationProvider(),
    warnings,
  };
}

// Export the image generator service
export const imageGenerator = {
  generateEventPhoto,
  generateProfilePicture,
  isAIImageGenerationEnabled,
  getImageGenerationProvider,
  getRateLimitDelay,
  validateConfiguration,
};
