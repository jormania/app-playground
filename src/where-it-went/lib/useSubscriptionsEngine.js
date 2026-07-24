import { useEffect, useRef } from 'react';

function getMissedMonths(dayOfMonth, lastProcessedDate) {
  const missedDates = [];
  const today = new Date();
  
  // If never processed, check if it should be processed this month
  if (!lastProcessedDate) {
    const candidateDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (candidateDate <= today) {
      missedDates.push(candidateDate);
    }
    return missedDates;
  }

  const lastProcessed = new Date(lastProcessedDate);
  // Start from the month after last processed
  let currentCandidate = new Date(lastProcessed.getFullYear(), lastProcessed.getMonth() + 1, dayOfMonth);

  // Safety net: don't loop forever (max 12 months)
  let iterations = 0;
  while (currentCandidate <= today && iterations < 12) {
    missedDates.push(new Date(currentCandidate));
    currentCandidate = new Date(currentCandidate.getFullYear(), currentCandidate.getMonth() + 1, dayOfMonth);
    iterations++;
  }
  
  return missedDates;
}

export function useSubscriptionsEngine({ data, client, onDataChange }) {
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run if we have data and haven't run yet for this session
    if (!data || !data.subscriptions || data.subscriptions.length === 0 || hasRun.current) {
      return;
    }

    const processSubscriptions = async () => {
      let madeChanges = false;
      const activeSubscriptions = data.subscriptions.filter(s => s.active);

      for (const sub of activeSubscriptions) {
        const missedDates = getMissedMonths(sub.dayOfMonth, sub.lastProcessed);
        
        if (missedDates.length > 0) {
          // Process all missed dates
          for (const date of missedDates) {
            const tx = {
              description: sub.name,
              amount: sub.amount,
              type: sub.type,
              categoryId: sub.categoryId,
              accountId: sub.accountId,
              date: date.toISOString(), // Set the date to the exact missed date
              tags: ['Subscription', 'Auto-generated']
            };
            
            try {
              await client.addTransaction(tx);
              madeChanges = true;
            } catch (e) {
              console.error(`Failed to auto-generate transaction for ${sub.name}:`, e);
            }
          }

          // Update the subscription's lastProcessed to the latest generated date
          const latestDate = missedDates[missedDates.length - 1];
          try {
            await client.updateSubscription(sub.id, { lastProcessed: latestDate.toISOString() });
          } catch (e) {
            console.error(`Failed to update lastProcessed for ${sub.name}:`, e);
          }
        }
      }

      if (madeChanges && onDataChange) {
        onDataChange();
      }
    };

    processSubscriptions();
    hasRun.current = true; // Mark as run so we don't trigger it on every re-render
  }, [data, client, onDataChange]);
}
