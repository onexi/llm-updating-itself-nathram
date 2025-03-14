import dotenv from 'dotenv';
import { OpenAI } from 'openai';

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Use your OpenAI API key here
});

async function testAPI() {
  try {
    // Call the OpenAI API using the correct method for chat completions
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',  // or 'gpt-4' depending on your API access
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' },
      ],
    });

    // Log the response from OpenAI
    console.log(response);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Execute the testAPI function
testAPI();
