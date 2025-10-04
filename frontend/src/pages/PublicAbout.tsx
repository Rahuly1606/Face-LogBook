import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Camera,
    Users,
    FileSpreadsheet,
    Brain,
    Shield,
    Zap,
    ArrowRight,
    LogIn
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PublicAbout: React.FC = () => {
    const features = [
        {
            icon: Camera,
            title: "AI-Powered Face Recognition",
            description: "Advanced facial recognition technology for accurate student identification.",
            color: "text-blue-600"
        },
        {
            icon: Users,
            title: "Group Management",
            description: "Organize students into groups with comprehensive management tools.",
            color: "text-green-600"
        },
        {
            icon: FileSpreadsheet,
            title: "Bulk Import System",
            description: "Import multiple students at once with CSV files and progress tracking.",
            color: "text-purple-600"
        },
        {
            icon: Brain,
            title: "Smart Analytics",
            description: "Detailed attendance reports and insights to track engagement patterns.",
            color: "text-orange-600"
        },
        {
            icon: Shield,
            title: "Secure & Reliable",
            description: "Enterprise-grade security with data encryption and cloud infrastructure.",
            color: "text-red-600"
        },
        {
            icon: Zap,
            title: "Real-time Processing",
            description: "Instant attendance marking with live camera feeds and immediate updates.",
            color: "text-yellow-600"
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            {/* Header */}
            <header className="border-b border-border/30 bg-background/95 backdrop-blur-sm shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-lg bg-primary shadow-md">
                                <Camera className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <span className="font-bold text-xl text-foreground tracking-tight">
                                FaceAttend
                            </span>
                        </div>
                        <Button asChild>
                            <Link to="/login" className="flex items-center gap-2">
                                <LogIn className="h-4 w-4" />
                                Login
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

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
                        <Button size="lg" asChild className="px-8 py-3">
                            <Link to="/login" className="flex items-center gap-2">
                                <LogIn className="h-5 w-5" />
                                Get Started
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
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
                                    <p className="text-gray-600 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
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
                            <Button size="lg" variant="secondary" asChild className="px-8 py-3">
                                <Link to="/login" className="flex items-center gap-2">
                                    <LogIn className="h-5 w-5" />
                                    Start Your Journey
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PublicAbout;