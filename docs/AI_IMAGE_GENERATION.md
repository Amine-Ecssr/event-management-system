# AI Image Generation for Sample Data

This document explains how to use AI-generated images for sample data in the ECSSR Events Calendar application.

## Overview

The sample data seeding feature now supports generating illustrated images for:
- **Profile Pictures**: For contacts and speakers (professional cartoon-style portraits)
- **Event Photos**: For archived events in the harvest (الحصاد) section (illustrated event scenes)

All images use a **professional yet cartoonish/illustrated style** to clearly indicate they are sample/demo content, not real photographs. Images are automatically uploaded to MinIO storage and properly referenced in the database.

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# AI Image Generation (optional - for sample data)
AI_IMAGE_PROVIDER=openai        # or 'placeholder' for colored placeholders
AI_IMAGE_API_KEY=sk-...         # Your OpenAI API key
```

### Options

1. **OpenAI DALL-E 3** (Recommended for illustrated images)
   - Set `AI_IMAGE_PROVIDER=openai`
   - Set `AI_IMAGE_API_KEY` to your OpenAI API key
   - Generates professional illustrated images using DALL-E 3
   - Uses cartoon/vector art style to clearly indicate sample content
   - Costs approximately $0.04 per image (standard quality, 1024x1024)

2. **Placeholder Images** (Default - Free)
   - Set `AI_IMAGE_PROVIDER=placeholder` or leave `AI_IMAGE_API_KEY` empty
   - Generates simple colored rectangles with text
   - No API key required
   - Perfect for testing and development

## Getting an OpenAI API Key

1. Sign up at [platform.openai.com](https://platform.openai.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Add credits to your account (minimum $5)
5. Copy the key to your `.env` file

## Usage

### Running the Seed Script

```bash
# With AI generation (requires API key)
npm run seed:sample-data

# The script will automatically:
# 1. Check MinIO availability
# 2. Check if AI generation is configured
# 3. Generate profile pictures for all contacts
# 4. Generate event photos for all archived events
# 5. Upload all images to MinIO
```

### What Gets Generated

#### Profile Pictures
- **Size**: 1024x1024 pixels
- **Style**: Professional illustrated portraits (cartoon/vector art style)
- **Background**: Clean, neutral/business setting
- **Purpose**: Clearly identifiable as sample data, not real photos
- **Based on**: Contact name and job title
- **Stored in**: MinIO `ecssr-archive` bucket under `photos/` and `thumbnails/`

#### Event Photos
- **Size**: 1792x1024 pixels (landscape)
- **Style**: Professional illustrations (rotating between professional, formal, and casual themes)
- **Appearance**: Vibrant cartoon/vector art style to indicate sample content
- **Based on**: Event name and description
- **Count**: 2-3 photos per archived event
- **Stored in**: MinIO `ecssr-archive` bucket under `photos/` and `thumbnails/`

### Cost Estimation

For the current sample data:
- **15 contacts** × $0.04 = $0.60
- **7 archived events** × 2-3 photos × $0.04 = $0.56 - $0.84
- **Total**: ~$1.20 - $1.50 per full seed

> **Note**: These are approximate costs for standard quality 1024x1024 images. Actual costs may vary.

## MinIO Storage

All generated images are stored in MinIO with:
- **Original Image**: Full resolution photo
- **Thumbnail**: 300×200 pixels (for events) or optimized for profile pictures
- **Automatic Cleanup**: Old sample data images are removed when re-seeding

### Buckets Used
- `ecssr-archive`: For archived event photos and profile pictures
- `ecssr-events`: For event-specific files (future use)

## Troubleshooting

### MinIO Not Available
```
⚠️  MinIO is not available. Images will not be generated.
   Please ensure MinIO is running or configure it in your environment variables.
```

**Solution**: 
- Check that MinIO container is running: `docker-compose ps`
- Verify MinIO environment variables in `.env`
- Start MinIO: `docker-compose up -d minio`

### AI Generation Disabled
```
🎨 Image generation: Placeholder (AI not configured)
ℹ️  To use AI-generated images, set AI_IMAGE_PROVIDER=openai and AI_IMAGE_API_KEY in your .env file
```

**Solution**: Add your OpenAI API key to `.env` file

### Rate Limiting
If you encounter rate limiting errors from OpenAI:
- The script includes a 1-second delay between image generations
- Consider upgrading your OpenAI account tier
- Use placeholder images instead

### Out of Credits
```
Failed to generate image with OpenAI: insufficient_quota
```

**Solution**: Add credits to your OpenAI account at platform.openai.com

## Development Mode

For faster development iterations without generating images:

1. **Option 1**: Use placeholder images
   ```bash
   AI_IMAGE_PROVIDER=placeholder
   ```

2. **Option 2**: Keep existing sample data
   ```bash
   # Don't run seed:sample-data during development
   # Or use --reset flag to clear without re-seeding
   npm run seed:sample-data -- --reset
   ```

## Technical Details

### Image Generator Service

Location: `server/services/imageGenerator.ts`

Key functions:
- `generateProfilePicture(name, jobTitle, gender?)`: Generate a professional headshot
- `generateEventPhoto(name, description, style)`: Generate an event photo
- `isAIImageGenerationEnabled()`: Check if AI is configured

### Sample Data Script

Location: `server/scripts/seedSampleData.ts`

Key changes:
- `generateAndUploadProfilePicture()`: Helper to generate and upload profile pictures
- `generateAndUploadEventPhotos()`: Helper to generate and upload event photos
- `seedContacts()`: Now generates profile pictures for all contacts
- `seedArchivedEvents()`: Now generates photos for all archived events

## Best Practices

1. **Use AI Generation Sparingly**: Only use for production-like demos
2. **Placeholder for Development**: Use placeholder images during active development
3. **Cache Results**: Consider saving generated images to avoid regenerating
4. **Monitor Costs**: Keep track of your OpenAI usage
5. **Test MinIO First**: Ensure MinIO is working before enabling AI generation

## Future Enhancements

Potential improvements for future versions:
- Support for additional AI providers (Stability AI, Replicate)
- Image caching to reduce API calls
- Batch image generation for better performance
- Custom image styles and themes
- User-uploadable sample images
