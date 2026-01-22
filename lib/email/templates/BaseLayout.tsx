import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

export type BaseLayoutProps = {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
  unsubscribeText?: string;
};

export function BaseLayout({
  preview,
  children,
  unsubscribeUrl,
  unsubscribeText = 'Unsubscribe from these emails',
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logo}>Spliq</Text>
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Spliq - Split expenses with friends, effortlessly.
            </Text>
            {unsubscribeUrl && (
              <Text style={styles.unsubscribe}>
                <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
                  {unsubscribeText}
                </Link>
              </Text>
            )}
            <Text style={styles.footerMeta}>
              © {new Date().getFullYear()} Spliq. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#f6f9fc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '20px 0 48px',
    marginBottom: '64px',
    maxWidth: '600px',
  },
  header: {
    padding: '24px 48px',
    borderBottom: '1px solid #e6ebf1',
  },
  logo: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#7c3aed',
    margin: '0',
    letterSpacing: '-0.5px',
  },
  content: {
    padding: '32px 48px',
  },
  hr: {
    borderColor: '#e6ebf1',
    margin: '0',
  },
  footer: {
    padding: '24px 48px',
  },
  footerText: {
    color: '#8898aa',
    fontSize: '14px',
    margin: '0 0 8px',
  },
  unsubscribe: {
    margin: '16px 0 0',
  },
  unsubscribeLink: {
    color: '#8898aa',
    fontSize: '12px',
    textDecoration: 'underline',
  },
  footerMeta: {
    color: '#b4bcc7',
    fontSize: '12px',
    margin: '12px 0 0',
  },
} as const;

export default BaseLayout;
