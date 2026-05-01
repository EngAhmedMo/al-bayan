import React from 'react';
import { ReviewForecast, MistakeHistoryChart, AccuracyTrendChart, ConsistencyHeatmap, SRSStrengthChart } from '../HifzAnalytics';
import { SrsItem } from '../../../services/srsAlgorithm';
import { HifzTestResult } from '../../../services/hifzManager';

interface HifzChartsSectionProps {
    srsItems: SrsItem[];
    mistakeMap: { [key: string]: number };
    history: string[];
    testHistory: HifzTestResult[];
    onDayClick?: (date: string, isDone: boolean, testResult?: HifzTestResult) => void;
}

export const HifzChartsSection: React.FC<HifzChartsSectionProps> = ({
    srsItems,
    mistakeMap,
    history,
    testHistory,
    onDayClick
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-100 dark:border-navy-700 shadow-sm space-y-6">
                <ReviewForecast srsItems={srsItems} />
                <MistakeHistoryChart mistakeMap={mistakeMap} />
                <ConsistencyHeatmap history={history} onDayClick={onDayClick} />
            </div>
            <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-gray-100 dark:border-navy-700 shadow-sm">
                <AccuracyTrendChart history={testHistory} />
                <SRSStrengthChart srsItems={srsItems} />
            </div>
        </div>
    );
};
