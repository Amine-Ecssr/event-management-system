/**
 * Test script for image generation and MinIO upload
 * 
 * This script tests the image generation service without
 * seeding the entire database.
 */

import 'dotenv/config';
import { imageGenerator } from '../services/imageGenerator';
import { minioService } from '../services/minio';

async function testImageGeneration() {
  console.log('🧪 Testing Image Generation Service\n');
  
  // Validate configuration
  console.log('=== Configuration Validation ===');
  const config = imageGenerator.validateConfiguration();
  console.log(`Provider: ${config.provider}`);
  console.log(`AI Enabled: ${imageGenerator.isAIImageGenerationEnabled()}`);
  
  if (config.warnings.length > 0) {
    console.log('\n⚠️  Configuration Warnings:');
    config.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  if (!config.isValid && imageGenerator.isAIImageGenerationEnabled()) {
    console.error('\n❌ Invalid configuration. Please check your environment variables.');
    process.exit(1);
  }
  
  console.log('\n=== MinIO Availability ===');
  const minioAvailable = await minioService.isMinioAvailable();
  console.log(`MinIO Available: ${minioAvailable}\n`);
  
  if (!minioAvailable) {
    console.error('❌ MinIO is not available. Please start MinIO before running this test.');
    process.exit(1);
  }
  
  try {
    // Test 1: Generate a profile picture
    console.log('Test 1: Generating profile picture...');
    const profilePic = await imageGenerator.generateProfilePicture(
      'John Doe',
      'Chief Technology Officer'
    );
    console.log(`✅ Generated profile picture: ${profilePic.width}x${profilePic.height}, ${profilePic.mimeType}`);
    
    // Upload to MinIO
    const profileUpload = await minioService.uploadImage(
      profilePic.buffer,
      'test_profile.png',
      profilePic.mimeType
    );
    console.log(`✅ Uploaded to MinIO: ${profileUpload.objectKey}\n`);
    
    // Test 2: Generate an event photo
    console.log('Test 2: Generating event photo...');
    const eventPhoto = await imageGenerator.generateEventPhoto(
      'Technology Summit 2025',
      'A major technology conference featuring industry leaders and innovators',
      'professional'
    );
    console.log(`✅ Generated event photo: ${eventPhoto.width}x${eventPhoto.height}, ${eventPhoto.mimeType}`);
    
    // Upload to MinIO
    const eventUpload = await minioService.uploadImage(
      eventPhoto.buffer,
      'test_event.png',
      eventPhoto.mimeType
    );
    console.log(`✅ Uploaded to MinIO: ${eventUpload.objectKey}\n`);
    
    // Test 3: Generate signed URLs
    console.log('Test 3: Generating signed URLs...');
    const profileUrl = minioService.generateSignedMediaUrl(profileUpload.objectKey);
    const eventUrl = minioService.generateSignedMediaUrl(eventUpload.objectKey);
    
    console.log(`Profile Picture URL: ${profileUrl}`);
    console.log(`Event Photo URL: ${eventUrl}\n`);
    
    // Cleanup
    console.log('Cleaning up test images...');
    await minioService.deleteImage(profileUpload.objectKey, profileUpload.thumbnailKey);
    await minioService.deleteImage(eventUpload.objectKey, eventUpload.thumbnailKey);
    console.log('✅ Cleanup complete\n');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testImageGeneration()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
