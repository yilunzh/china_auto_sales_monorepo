import { useEffect } from 'react';
import fs from 'fs';
import path from 'path';

export default function Debug() {
  useEffect(() => {
    console.log('Debug page loaded');
  }, []);

  return (
    <div>
      <h1>Debug Page</h1>
      <p>This page helps diagnose import issues.</p>
      <div>
        <pre>
          {JSON.stringify({
            nodePath: process.env.NODE_PATH,
            dirname: __dirname,
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  // Try to read the utils file directly
  try {
    const utilsPath = path.join(process.cwd(), 'src', 'lib', 'utils.ts');
    console.log('Checking for utils.ts at:', utilsPath);
    const exists = fs.existsSync(utilsPath);
    
    return {
      props: {
        utilsExists: exists,
        utilsPath,
      }
    };
  } catch (error) {
    console.error('Error checking utils file:', error);
    return {
      props: {
        error: error.message
      }
    };
  }
} 