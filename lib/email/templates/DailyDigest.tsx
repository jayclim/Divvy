import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './BaseLayout';

export type DigestItem = {
  type: 'expense_added' | 'settlement_received' | 'member_joined' | 'member_left';
  groupName: string;
  groupId: number;
  description: string;
  amount?: string;
  actorName: string;
  timestamp: string;
};

export type DailyDigestProps = {
  userName: string;
  items: DigestItem[];
  appUrl: string;
  unsubscribeUrl: string;
};

export function DailyDigest({
  userName,
  items,
  appUrl,
  unsubscribeUrl,
}: DailyDigestProps) {
  const itemCount = items.length;
  const preview = `You have ${itemCount} new update${itemCount === 1 ? '' : 's'} from your Spliq groups`;

  // Group items by group
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.groupName]) {
      acc[item.groupName] = { groupId: item.groupId, items: [] };
    }
    acc[item.groupName].items.push(item);
    return acc;
  }, {} as Record<string, { groupId: number; items: DigestItem[] }>);

  return (
    <BaseLayout
      preview={preview}
      unsubscribeUrl={unsubscribeUrl}
      unsubscribeText="Update your notification preferences"
    >
      <Heading style={styles.heading}>
        Your Daily Spliq Update
      </Heading>

      <Text style={styles.greeting}>
        Hi {userName},
      </Text>

      <Text style={styles.text}>
        Here&apos;s what happened in your groups today:
      </Text>

      {Object.entries(groupedItems).map(([groupName, { groupId, items: groupItems }]) => (
        <Section key={groupName} style={styles.groupSection}>
          <Text style={styles.groupName}>
            <Link href={`${appUrl}/groups/${groupId}`} style={styles.groupLink}>
              {groupName}
            </Link>
          </Text>

          {groupItems.map((item, index) => (
            <Section key={index} style={styles.itemRow}>
              <Text style={styles.itemIcon}>
                {getItemIcon(item.type)}
              </Text>
              <Text style={styles.itemContent}>
                <strong>{item.actorName}</strong>{' '}
                {getItemDescription(item)}
                {item.amount && (
                  <span style={styles.amount}> ${item.amount}</span>
                )}
              </Text>
            </Section>
          ))}

          <Hr style={styles.groupDivider} />
        </Section>
      ))}

      <Section style={styles.ctaSection}>
        <Link href={appUrl} style={styles.ctaLink}>
          View all activity in Spliq →
        </Link>
      </Section>
    </BaseLayout>
  );
}

function getItemIcon(type: DigestItem['type']): string {
  switch (type) {
    case 'expense_added':
      return '💰';
    case 'settlement_received':
      return '✅';
    case 'member_joined':
      return '👋';
    case 'member_left':
      return '👤';
    default:
      return '•';
  }
}

function getItemDescription(item: DigestItem): string {
  switch (item.type) {
    case 'expense_added':
      return `added "${item.description}"`;
    case 'settlement_received':
      return `recorded a payment`;
    case 'member_joined':
      return `joined the group`;
    case 'member_left':
      return `left the group`;
    default:
      return item.description;
  }
}

const styles = {
  heading: {
    color: '#1a1a1a',
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: '32px',
    margin: '0 0 24px',
  },
  greeting: {
    color: '#525f7f',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 8px',
  },
  text: {
    color: '#525f7f',
    fontSize: '16px',
    lineHeight: '26px',
    margin: '0 0 24px',
  },
  groupSection: {
    margin: '0 0 8px',
  },
  groupName: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 12px',
  },
  groupLink: {
    color: '#7c3aed',
    textDecoration: 'none',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'flex-start',
    margin: '0 0 8px',
    paddingLeft: '8px',
  },
  itemIcon: {
    width: '24px',
    fontSize: '14px',
    margin: '0 8px 0 0',
    lineHeight: '22px',
  },
  itemContent: {
    color: '#525f7f',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
    flex: '1',
  },
  amount: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  groupDivider: {
    borderColor: '#e6ebf1',
    margin: '16px 0',
  },
  ctaSection: {
    textAlign: 'center' as const,
    margin: '24px 0 0',
  },
  ctaLink: {
    color: '#7c3aed',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
  },
} as const;

export default DailyDigest;
