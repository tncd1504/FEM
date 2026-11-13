Gid Post Results File 1.0 
### 
# MAT-fem Shell QLLL v1.2 
# 
GaussPoints "GPTR" ElemType Quadrilateral  
Number Of Gauss Points: 1  
Natural Coordinates: Internal  
End gausspoints 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1         00000          00000          00000 
     2         00000          00000          00000 
     3         00000          00000          00000 
     4  5.15781e-021  -1.04624e-020  -1.06838e-003 
     5         00000          00000          00000 
     6         00000          00000          00000 
     7         00000          00000          00000 
     8         00000          00000          00000 
     9         00000          00000          00000 
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1         00000         00000 0.0  
     2         00000         00000 0.0  
     3         00000         00000 0.0  
     4  1.12375e-020 -5.68670e-021 0.0  
     5         00000         00000 0.0  
     6         00000         00000 0.0  
     7         00000         00000 0.0  
     8         00000         00000 0.0  
     9         00000         00000 0.0  
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1  4.77938e-001 -4.77938e-001  8.96223e+000  
     2 -3.84287e+000  7.69134e-016  1.45773e+001  
     3 -3.85202e-016  3.84287e+000  1.45773e+001  
     4         00000         00000         00000  
     5 -4.77938e-001 -4.77938e-001  8.96223e+000  
     6  4.77938e-001  4.77938e-001  8.96223e+000  
     7  3.84287e+000  4.03667e-017  1.45773e+001  
     8 -3.85202e-016 -3.84287e+000  1.45773e+001  
     9 -4.77938e-001  4.77938e-001  8.96223e+000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Local-X-Moment", "Local-Y-Moment", "Local-Z-Moment" 
Values 
     1  3.07675e+001  2.96061e+001         00000  
     2 -3.42550e-015  1.16275e+002         00000  
     3  1.18468e+002 -4.12049e-015         00000  
     4         00000         00000         00000  
     5  3.07675e+001 -2.96061e+001         00000  
     6 -3.07675e+001  2.96061e+001         00000  
     7  4.61258e-016 -1.16275e+002         00000  
     8 -1.18468e+002 -2.33729e-016         00000  
     9 -3.07675e+001 -2.96061e+001         00000  
End Values 
# 
Result "Local Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1 -1.64512e-021   1.77636e-022  -2.79615e-022 
     2 -6.66822e-020  -1.66705e-019   9.88277e-020 
     3  3.29097e-019   1.31639e-019  -4.99617e-020 
     4 -1.20371e-035  -7.52316e-036   1.50463e-035 
     5 -2.44101e-021  -1.81209e-021   8.99949e-022 
     6  2.44101e-021   1.81209e-021  -8.99949e-022 
     7  6.66822e-020   1.66705e-019  -9.88277e-020 
     8 -3.29097e-019  -1.31639e-019   4.99617e-020 
     9  1.64512e-021  -1.77636e-022   2.79615e-022 
End Values 
Result "Local Membrane" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Nx", "Ny", "Nxy" 
Values 
     1  9.78800e-004   9.47056e-004   4.12378e-004 
     2  6.93889e-018          00000  -3.43277e-002 
     3         00000  -6.93889e-018  -3.16528e-002 
     4  6.93889e-018  -6.93889e-018  -6.90651e-002 
     5 -9.78800e-004  -9.47056e-004   4.12378e-004 
     6 -9.78800e-004  -9.47056e-004   4.12378e-004 
     7  6.93889e-018   2.77556e-017  -3.43277e-002 
     8  6.93889e-018          00000  -3.16528e-002 
     9  9.78800e-004   9.47056e-004   4.12378e-004 
End Values 
Result "Local Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1  8.76135e-004   8.43061e-004  0.0 
     2  3.81639e-017  -1.41269e-001  0.0 
     3 -1.41128e-001  -1.04083e-017  0.0 
     4 -4.16334e-017   2.08167e-017  0.0 
     5  8.76135e-004  -8.43061e-004  0.0 
     6 -8.76135e-004   8.43061e-004  0.0 
     7  3.46945e-018   1.41269e-001  0.0 
     8  1.41128e-001   1.04083e-017  0.0 
     9 -8.76135e-004  -8.43061e-004  0.0 
End Values 
Result "X vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "XX", "XY", "XZ" 
Values 
     1 -9.80581e-001         00000 -1.96116e-001  
     2 -9.80581e-001         00000 -1.96116e-001  
     3 -9.80581e-001         00000  1.96116e-001  
     4 -9.80581e-001         00000  1.96116e-001  
End Values 
# 
Result "Y vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "YX", "YY", "YZ" 
Values 
     1 -3.77426e-002  9.81307e-001  1.88713e-001  
     2  3.77426e-002  9.81307e-001 -1.88713e-001  
     3 -3.77426e-002  9.81307e-001 -1.88713e-001  
     4  3.77426e-002  9.81307e-001  1.88713e-001  
End Values 
# 
Result "Z vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "ZX", "ZY", "ZZ" 
Values 
     1  1.92450e-001  1.92450e-001 -9.62250e-001  
     2  1.92450e-001 -1.92450e-001 -9.62250e-001  
     3 -1.92450e-001 -1.92450e-001 -9.62250e-001  
     4 -1.92450e-001  1.92450e-001 -9.62250e-001  
End Values 
# 
