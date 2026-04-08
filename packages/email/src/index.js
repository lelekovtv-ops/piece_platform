import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { createLogger } from '@piece/logger';

const logger = createLogger({ serviceName: 'email' });
const componentLogger = logger.createComponentLogger('SESClient');

let sesClient = null;
let emailConfig = null;

/**
 * Initialize the email client with config values.
 * Call once during service startup.
 *
 * @param {Object} config - ServiceConfig instance
 */
export const initializeEmail = (config) => {
  const region = config.get('SES_REGION');
  const accessKeyId = config.get('SES_ACCESS_KEY_ID');
  const secretAccessKey = config.get('SES_SECRET_ACCESS_KEY');

  const clientConfig = { region };

  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = { accessKeyId, secretAccessKey };
  }

  sesClient = new SESv2Client(clientConfig);

  emailConfig = {
    fromEmail: config.get('FROM_EMAIL'),
    fromName: config.get('FROM_NAME'),
    configurationSet: config.get('SES_CONFIGURATION_SET'),
    disabled: config.get('DISABLE_EMAIL_SENDING') === true,
  };

  componentLogger.info('Email client initialized', { region });
};

/**
 * Send an email via AWS SES.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 * @param {Object} [options] - Additional options
 * @param {string} [options.correlationId] - Trace ID
 * @param {number} [options.retryAttempts=3] - Number of retry attempts
 * @param {number} [options.retryDelay=1000] - Base delay between retries in ms
 * @returns {Promise<{messageId: string}>}
 */
export const sendEmail = async (to, subject, htmlContent, options = {}) => {
  const { correlationId = null, retryAttempts = 3, retryDelay = 1000 } = options;

  if (!sesClient || !emailConfig) {
    throw new Error('Email client not initialized. Call initializeEmail(config) first.');
  }

  componentLogger.info('Sending email', { to, subject, correlationId });

  if (emailConfig.disabled) {
    componentLogger.info('Email sending disabled (dev mode)', { to, subject, correlationId });
    return { messageId: 'mock-' + Date.now() };
  }

  const params = {
    FromEmailAddress: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: htmlContent, Charset: 'UTF-8' } },
      },
    },
  };

  if (emailConfig.configurationSet) {
    params.ConfigurationSetName = emailConfig.configurationSet;
  }

  let lastError;
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const command = new SendEmailCommand(params);
      const result = await sesClient.send(command);

      componentLogger.info('Email sent', {
        to, subject, messageId: result.MessageId, attempt, correlationId,
      });

      return { messageId: result.MessageId };
    } catch (error) {
      lastError = error;
      componentLogger.warn('Email send attempt failed', {
        to, subject, attempt, totalAttempts: retryAttempts, error: error.message, correlationId,
      });

      if (attempt < retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  componentLogger.error('Failed to send email after all attempts', {
    to, subject, attempts: retryAttempts, error: lastError.message, correlationId,
  });
  throw lastError;
};

/**
 * Reset client (for testing).
 */
export const resetEmailClient = () => {
  sesClient = null;
  emailConfig = null;
};
