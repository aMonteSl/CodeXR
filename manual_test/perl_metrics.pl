# Perl fixture for CodeXR metrics
package MetricBox;

sub compute {
    my ($values, $limit) = @_;
    my $total = 0;
    foreach my $value (@{$values}) {
        if ($value > $limit) {
            if ($value % 2 == 0) {
                $total += $value;
            } else {
                $total += $limit;
            }
        }
    }
    return $total;
}

sub helper {
    my ($value, $offset) = @_;
    if ($value > $offset) {
        if ($offset > 0) {
            return $value + $offset;
        }
    }
    return $value;
}

1;
