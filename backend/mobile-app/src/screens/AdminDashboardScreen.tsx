import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import SecureStorage from '../services/secureStorage';

interface DashboardData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    totalRevenue: number;
    monthlyRevenue: number;
    totalCourses: number;
    totalLectures: number;
  };
  performance: {
    avgResponseTime: number;
    uptime: number;
    errorRate: number;
  };
  aiInsights: {
    recommendations: string[];
    riskFactors: string[];
    opportunities: string[];
  };
}

const AdminDashboardScreen = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = await SecureStorage.getItem('auth_token');
      const response = await axios.get(
        `${process.env.API_URL}/api/admin/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setData(response.data.data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Real-time platform metrics</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['overview', 'users', 'security', 'performance'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.activeTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Tab */}
      {selectedTab === 'overview' && data && (
        <View>
          {/* Key Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.summary.totalUsers}</Text>
              <Text style={styles.metricLabel}>Total Users</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.summary.activeUsers}</Text>
              <Text style={styles.metricLabel}>Active Users</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>₹{data.summary.totalRevenue}</Text>
              <Text style={styles.metricLabel}>Total Revenue</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{data.summary.totalCourses}</Text>
              <Text style={styles.metricLabel}>Courses</Text>
            </View>
          </View>

          {/* Performance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Performance</Text>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>Avg Response Time:</Text>
              <Text style={styles.performanceValue}>{data.performance.avgResponseTime}ms</Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>Uptime:</Text>
              <Text style={styles.performanceValue}>{data.performance.uptime}%</Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>Error Rate:</Text>
              <Text style={styles.performanceValue}>{data.performance.errorRate}%</Text>
            </View>
          </View>

          {/* AI Insights */}
          {data.aiInsights && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🤖 AI Insights</Text>
              {data.aiInsights.recommendations.map((rec, index) => (
                <View key={index} style={styles.insightItem}>
                  <Text style={styles.insightText}>• {rec}</Text>
                </View>
              ))}
              {data.aiInsights.opportunities.map((opp, index) => (
                <View key={index} style={styles.insightItem}>
                  <Text style={styles.insightText}>• {opp}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Users Tab */}
      {selectedTab === 'users' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 User Analytics</Text>
          <Text style={styles.placeholderText}>User analytics coming soon...</Text>
        </View>
      )}

      {/* Security Tab */}
      {selectedTab === 'security' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛡️ Security Alerts</Text>
          <Text style={styles.placeholderText}>Security dashboard coming soon...</Text>
        </View>
      )}

      {/* Performance Tab */}
      {selectedTab === 'performance' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Performance Metrics</Text>
          <Text style={styles.placeholderText}>Performance charts coming soon...</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1e3a8a',
  },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#93c5fd',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: -15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#1e3a8a',
  },
  tabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 12,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  performanceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  insightItem: {
    paddingVertical: 6,
  },
  insightText: {
    fontSize: 14,
    color: '#374151',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
  },
});

export default AdminDashboardScreen;