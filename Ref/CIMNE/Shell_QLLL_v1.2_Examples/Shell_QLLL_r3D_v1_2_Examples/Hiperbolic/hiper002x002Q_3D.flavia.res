Gid Post Results File 1.0 
### 
# MAT-fem Shell QLLL r3D v1.2 
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
     4  5.47765e-021  -1.02576e-020  -1.06838e-003 
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
     1         00000         00000         00000  
     2         00000         00000         00000  
     3         00000         00000         00000  
     4  5.92205e-021 -1.16729e-020 -2.25985e-020  
     5         00000         00000         00000  
     6         00000         00000         00000  
     7         00000         00000         00000  
     8         00000         00000         00000  
     9         00000         00000         00000  
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1  4.77938e-001 -4.77938e-001  8.96223e+000  
     2 -3.84287e+000  7.63763e-016  1.45773e+001  
     3 -3.86577e-016  3.84287e+000  1.45773e+001  
     4         00000         00000         00000  
     5 -4.77938e-001 -4.77938e-001  8.96223e+000  
     6  4.77938e-001  4.77938e-001  8.96223e+000  
     7  3.84287e+000  3.49959e-017  1.45773e+001  
     8 -3.86577e-016 -3.84287e+000  1.45773e+001  
     9 -4.77938e-001  4.77938e-001  8.96223e+000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 -3.01924e+001 -3.01924e+001 -2.03538e-015  
     2 -1.16254e+002  7.31222e-015 -1.16211e+001  
     3  2.31753e-016 -1.16254e+002  1.16211e+001  
     4         00000         00000         00000  
     5  3.01924e+001 -3.01924e+001 -1.00779e-015  
     6 -3.01924e+001  3.01924e+001  3.21764e-015  
     7  1.16254e+002 -4.61300e-016 -1.16211e+001  
     8  4.11851e-015  1.16254e+002  1.16211e+001  
     9  3.01924e+001  3.01924e+001  1.65070e-015  
End Values 
# 
Result "Local Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1 -1.17036e-021  -2.66063e-022  -2.90629e-022 
     2 -1.52434e-020  -3.99591e-020   1.00738e-019 
     3  2.08220e-019   7.83603e-020  -5.09303e-020 
     4 -7.79129e-020   7.79129e-020  -9.02780e-036 
     5 -2.06436e-021  -2.33040e-021   9.47553e-022 
     6  2.99478e-021   1.39999e-021  -9.11741e-022 
     7  1.20856e-019   3.00473e-019  -1.00738e-019 
     8 -4.62699e-019  -1.90008e-019   5.09303e-020 
     9  2.10077e-021  -6.64352e-022   2.54817e-022 
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
     2  3.12250e-017  -1.41269e-001  0.0 
     3 -1.41128e-001  -6.93889e-018  0.0 
     4 -4.16334e-017   1.38778e-017  0.0 
     5  8.76135e-004  -8.43061e-004  0.0 
     6 -8.76135e-004   8.43061e-004  0.0 
     7  6.93889e-018   1.41269e-001  0.0 
     8  1.41128e-001   6.93889e-018  0.0 
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
