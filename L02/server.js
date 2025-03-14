import express from 'express';
import bodyParser from 'body-parser';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Could not figure out how to get it to recognize the .env file, I've just been running export OPENAI_API_KEY=

// Initialize Express server
const app = express();
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.resolve(process.cwd(), './L02/public')));

// OpenAI API configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to dynamically load all available tools/functions
async function getFunctions() {
  const loadFrom = ['./L02/functions', './L02/Tools'];
  const openAIFunctions = {};

  for (const dir of loadFrom) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const moduleName = file.slice(0, -3);
        const modulePath = `${dir}/${moduleName}.js`;
        openAIFunctions[moduleName] = await import(modulePath);
      }
    }
  }
  return openAIFunctions;
}

// Route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), './L02/public/index.html'));
});

// Route to execute functions
app.post('/execute-function', async (req, res) => {
  const { functionName, parameters } = req.body;

  console.log('Received request:', JSON.stringify(req.body, null, 2));

  const functions = await getFunctions();

  if (!functions[functionName]) {
    return res.status(404).json({ error: 'Function not found' });
  }

  try {
    console.log(`Calling function: ${functionName} with parameters:`, parameters);

    const result = await functions[functionName].execute(...Object.values(parameters));

    console.log(`Function output: ${JSON.stringify(result)}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Function execution failed', details: err.message });
  }
});

// Route for OpenAI to generate and use new functions
app.post('/openai-function-call', async (req, res) => {
  const { userPrompt } = req.body;

  const functions = await getFunctions();
  const availableFunctions = Object.values(functions).map(fn => fn.details);

  try {
    // OpenAI API call only if there are functions available
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: userPrompt }],
      tools: availableFunctions.length > 0 ? availableFunctions : undefined,
    });

    const completion = response.choices[0];
    const calledFunction = completion.function_call;

    if (calledFunction) {
      const functionName = calledFunction.name;
      const parameters = JSON.parse(calledFunction.arguments);

      if (!functions[functionName]) {
        console.log(`Saving new function: ${functionName}`);

        // Generate function code dynamically
        const functionCode = `
        const execute = async (${Object.keys(parameters).join(', ')}) => {
            return { result: ${Object.keys(parameters).join(' * ')} };
        };

        const details = {
            type: "function",
            function: {
                name: "${functionName}",
                parameters: {
                    type: "object",
                    properties: ${JSON.stringify(parameters, null, 2)}
                },
                required: ${JSON.stringify(Object.keys(parameters))}
            }
        };

        export { execute, details };
        `;

        // Save function to Tools/
        fs.writeFileSync(`./L02/Tools/${functionName}.js`, functionCode);
        functions[functionName] = await import(`./L02/Tools/${functionName}.js`);
      }

      const result = await functions[functionName].execute(...Object.values(parameters));
      res.json({ result });
    } else {
      res.json({ message: 'No function called by the model' });
    }
  } catch (error) {
    res.status(500).json({ error: 'OpenAI API failed', details: error.message });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
