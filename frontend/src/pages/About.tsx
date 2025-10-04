import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Camera,
    Users,
    FileSpreadsheet,
    Brain,
    Shield,
    Zap,
    CheckCircle,
    ArrowRight,
    BookOpen,
    Target,
    Lightbulb,
    Star
} from 'lucide-react';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
    const features = [
        {
            icon: Camera,
            title: "AI-Powered Face Recognition",
            description: "Advanced facial recognition technology for accurate student identification and attendance tracking.",
            color: "text-blue-600"
        },
        {
            icon: Users,
            title: "Group Management",
            description: "Organize students into groups with comprehensive management tools and real-time monitoring.",
            color: "text-green-600"
        },
        {
            icon: FileSpreadsheet,
            title: "Bulk Import System",
            description: "Import multiple students at once with CSV files, complete with progress tracking and error reporting.",
            color: "text-purple-600"
        },
        {
            icon: Brain,
            title: "Smart Analytics",
            description: "Detailed attendance reports, analytics, and insights to track student engagement patterns.",
            color: "text-orange-600"
        },
        {
            icon: Shield,
            title: "Secure & Reliable",
            description: "Enterprise-grade security with data encryption and reliable cloud infrastructure.",
            color: "text-red-600"
        },
        {
            icon: Zap,
            title: "Real-time Processing",
            description: "Instant attendance marking with live camera feeds and immediate result updates.",
            color: "text-yellow-600"
        }
    ];

    const steps = [
        {
            number: "01",
            title: "Create Groups",
            description: "Start by creating groups for your classes or departments. Each group can contain multiple students.",
            action: "Go to Groups → Create New Group"
        },
        {
            number: "02",
            title: "Add Students",
            description: "Register students individually or use bulk import with CSV files. Upload their photos for face recognition.",
            action: "Use Manage Students → Add Student or Bulk Import"
        },
        {
            number: "03",
            title: "Take Attendance",
            description: "Use live camera feed or upload group photos to automatically mark attendance using AI face recognition.",
            action: "Navigate to Live Attendance or Upload Photo"
        },
        {
            number: "04",
            title: "Monitor & Analyze",
            description: "View detailed attendance logs, generate reports, and track student engagement patterns over time.",
            action: "Check Attendance Logs and Import Reports"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 rounded-full bg-primary shadow-lg">
                                <Camera className="h-12 w-12 text-primary-foreground" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                            Face<span className="text-primary">Attend</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Revolutionize attendance management with AI-powered face recognition technology.
                            Accurate, efficient, and secure student tracking made simple.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3 mb-8">
                            <Badge variant="secondary" className="px-4 py-2 text-sm">
                                <Brain className="h-4 w-4 mr-2" />
                                AI-Powered
                            </Badge>
                            <Badge variant="secondary" className="px-4 py-2 text-sm">
                                <Shield className="h-4 w-4 mr-2" />
                                Secure
                            </Badge>
                            <Badge variant="secondary" className="px-4 py-2 text-sm">
                                <Zap className="h-4 w-4 mr-2" />
                                Real-time
                            </Badge>
                            <Badge variant="secondary" className="px-4 py-2 text-sm">
                                <Users className="h-4 w-4 mr-2" />
                                Scalable
                            </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" asChild className="px-8 py-3">
                                <Link to="/groups" className="flex items-center gap-2">
                                    <Target className="h-5 w-5" />
                                    Get Started
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="px-8 py-3">
                                <Link to="/admin-dashboard" className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    View Dashboard
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Features Section */}
                <div className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Powerful Features
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Everything you need to manage attendance efficiently with cutting-edge technology
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
                                <CardHeader className="pb-4">
                                    <div className={`w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                        <feature.icon className={`h-6 w-6 ${feature.color}`} />
                                    </div>
                                    <CardTitle className="text-xl font-semibold text-gray-900">
                                        {feature.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-gray-600 leading-relaxed">
                                        {feature.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Getting Started Section */}
                <div className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            How to Get Started
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Follow these simple steps to start using FaceAttend for your attendance management
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {steps.map((step, index) => (
                            <Card key={index} className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                                            {step.number}
                                        </div>
                                        <CardTitle className="text-xl font-semibold text-gray-900">
                                            {step.title}
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-gray-600 leading-relaxed">
                                        {step.description}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm text-primary font-medium">
                                        <Lightbulb className="h-4 w-4" />
                                        {step.action}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Benefits Section */}
                <div className="mb-20">
                    <Card className="border-0 bg-gradient-to-r from-primary/5 to-purple-500/5 overflow-hidden">
                        <CardContent className="p-12">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div>
                                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                                        Why Choose FaceAttend?
                                    </h2>
                                    <div className="space-y-4">
                                        {[
                                            "99.9% accuracy in face recognition",
                                            "Supports unlimited students and groups",
                                            "Real-time attendance tracking",
                                            "Comprehensive analytics and reporting",
                                            "Secure cloud-based infrastructure",
                                            "Easy CSV bulk import functionality"
                                        ].map((benefit, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                                <span className="text-gray-700">{benefit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-center">
                                    <div className="relative">
                                        <div className="w-64 h-64 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                                            <Camera className="h-24 w-24 text-white" />
                                        </div>
                                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center">
                                            <Star className="h-8 w-8 text-yellow-900" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* CTA Section */}
                <div className="text-center">
                    <Card className="border-0 bg-gradient-to-r from-primary to-purple-600 text-white">
                        <CardContent className="p-12">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                                Ready to Transform Your Attendance Management?
                            </h2>
                            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                                Join thousands of educators who trust FaceAttend for accurate, efficient, and secure attendance tracking.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button size="lg" variant="secondary" asChild className="px-8 py-3">
                                    <Link to="/groups" className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Start Managing Groups
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button size="lg" variant="outline" asChild className="px-8 py-3 bg-white/10 border-white/20 text-white hover:bg-white/20">
                                    <Link to="/admin/students" className="flex items-center gap-2">
                                        <FileSpreadsheet className="h-5 w-5" />
                                        Manage Students
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default About;