import {
  Button,
  Heading,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './BaseLayout';

export type GroupInvitationProps = {
  inviterName: string;
  groupName: string;
  inviteUrl: string;
  unsubscribeUrl: string;
};

export function GroupInvitation({
  inviterName,
  groupName,
  inviteUrl,
  unsubscribeUrl,
}: GroupInvitationProps) {
  const preview = `${inviterName} invited you to join ${groupName} on Spliq`;

  return (
    <BaseLayout
      preview={preview}
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeText="Unsubscribe / Stop receiving invitation emails"
    >
      <Heading style={styles.heading}>
        You&apos;re invited to join a group!
      </Heading>

      <Text style={styles.text}>
        <strong>{inviterName}</strong> has invited you to join{' '}
        <strong>{groupName}</strong> on Spliq.
      </Text>

      <Text style={styles.text}>
        Spliq makes it easy to split expenses with friends and keep track of who
        owes what. Accept the invitation to start sharing expenses with your group.
      </Text>

      <Section style={styles.buttonContainer}>
        <Button style={styles.button} href={inviteUrl}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={styles.alternativeText}>
        Or copy and paste this URL into your browser:{' '}
        <Link href={inviteUrl} style={styles.link}>
          {inviteUrl}
        </Link>
      </Text>

      <Text style={styles.note}>
        If you don&apos;t know {inviterName} or weren&apos;t expecting this
        invitation, you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}

const styles = {
  heading: {
    color: '#1a1a1a',
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '32px',
    margin: '0 0 24px',
  },
  text: {
    color: '#525f7f',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 16px',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    padding: '14px 32px',
  },
  alternativeText: {
    color: '#8898aa',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 16px',
  },
  link: {
    color: '#7c3aed',
    textDecoration: 'underline',
    wordBreak: 'break-all' as const,
  },
  note: {
    color: '#8898aa',
    fontSize: '13px',
    fontStyle: 'italic',
    lineHeight: '20px',
    margin: '24px 0 0',
    paddingTop: '16px',
    borderTop: '1px solid #e6ebf1',
  },
} as const;

export default GroupInvitation;
