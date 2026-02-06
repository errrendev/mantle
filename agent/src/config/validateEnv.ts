/**
 * Validates required environment variables on startup
 */
export function validateEnvironment(): void {
    const required = ['GEMINI_API_KEY', 'RPC_URL'];
    const missing: string[] = [];

    for (const key of required) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please check your .env file.'
        );
    }

    // Warn if private key is missing (optional for read-only operations)
    if (!process.env.PRIVATE_KEY) {
        console.warn('⚠️  PRIVATE_KEY not set - transaction features will be disabled');
    }

    console.log('✅ Environment variables validated');
}
