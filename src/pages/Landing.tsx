import { Link } from 'react-router-dom';
import { Zap, Trophy, Dumbbell, TrendingUp, Shield, Users, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Dumbbell,
    title: 'Train Your Creatures',
    description: 'Six specialized training activities to boost stats and prepare for competition.',
    color: 'text-primary',
    glow: 'group-hover:shadow-[0_0_30px_hsl(186_100%_50%/0.3)]',
  },
  {
    icon: Trophy,
    title: 'Compete in Races',
    description: 'Enter Sprint, Distance, Technical, Mixed, and Hazard races for rewards.',
    color: 'text-secondary',
    glow: 'group-hover:shadow-[0_0_30px_hsl(300_100%_50%/0.3)]',
  },
  {
    icon: TrendingUp,
    title: 'Climb the Ranks',
    description: 'Track your season performance on the leaderboard and earn prestige.',
    color: 'text-accent',
    glow: 'group-hover:shadow-[0_0_30px_hsl(156_100%_50%/0.3)]',
  },
  {
    icon: Shield,
    title: 'NFT Ownership',
    description: 'True ownership of your creatures on the blockchain.',
    color: 'text-race-sprint',
    glow: 'group-hover:shadow-[0_0_30px_hsl(50_100%_50%/0.3)]',
  },
];

const stats = [
  { value: '10K+', label: 'Creatures' },
  { value: '$2.5M', label: 'Prize Pool' },
  { value: '50K+', label: 'Races Run' },
  { value: '8K+', label: 'Trainers' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-accent/3 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-primary" />
          <span className="font-display text-xl font-bold text-foreground">
            CYBER<span className="text-primary">RACE</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link to="/leaderboard">Leaderboard</Link>
          </Button>
          <Button asChild className="glow-cyan">
            <Link to="/dashboard">
              Launch App
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-24 md:pt-24 md:pb-32 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Season: Neon Storm Active</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            Train. Race.{' '}
            <span className="gradient-text-cyber">Dominate.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '200ms' }}>
            The ultimate NFT creature racing experience. Train your digital beasts, 
            compete in high-stakes races, and climb the seasonal leaderboards.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Button asChild size="lg" className="text-lg px-8 glow-cyan">
              <Link to="/dashboard">
                Enter the Arena
                <Zap className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 border-muted-foreground/30">
              <Link to="/leaderboard">
                View Leaderboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-20 animate-fade-in" style={{ animationDelay: '400ms' }}>
          {stats.map((stat, i) => (
            <div 
              key={stat.label}
              className="text-center p-4 rounded-xl bg-card/50 border border-border/50"
            >
              <p className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1">
                {stat.value}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 py-20 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Build your stable, train your creatures, and compete for glory and rewards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={cn(
                  'group cyber-card rounded-xl p-6 transition-all duration-300',
                  feature.glow
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center mb-4',
                  'bg-muted/50'
                )}>
                  <feature.icon className={cn('w-6 h-6', feature.color)} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="cyber-card rounded-2xl p-8 md:p-12 border-gradient-cyber">
            <Users className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              Ready to Join the Race?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Connect your wallet, register your NFT creatures, and start competing 
              in the Neon Storm season today.
            </p>
            <Button asChild size="lg" className="text-lg px-10 glow-cyan">
              <Link to="/dashboard">
                Get Started
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-display text-sm text-muted-foreground">
              CYBERRACE © 2026
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
            <a href="#" className="hover:text-foreground transition-colors">Discord</a>
            <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
