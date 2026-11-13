Gid Post Results File 1.0 
### 
# MAT-fem Rev Shell v1.1 
# 
GaussPoints "GPTR" ElemType Linear  
Number Of Gauss Points: 1  
Natural Coordinates: Internal  
End gausspoints 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1         00000         00000 0  
     2 -3.48687e-005 -1.31562e-004 0  
     3 -1.12775e-004 -3.67829e-004 0  
     4 -1.58139e-004 -5.79766e-004 0  
     5 -1.60118e-004 -7.20403e-004 0  
     6 -1.32567e-004 -7.93314e-004 0  
     7 -9.13684e-005 -8.22735e-004 0  
     8 -4.61389e-005 -8.33542e-004 0  
     9         00000 -8.38432e-004 0  
End Values 
# 
Result "Local Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0  3.35125e-005 
     3 0.0 0.0  3.58733e-005 
     4 0.0 0.0  2.54838e-005 
     5 0.0 0.0  1.36395e-005 
     6 0.0 0.0  5.28686e-006 
     7 0.0 0.0  1.30519e-006 
     8 0.0 0.0  5.01215e-007 
     9 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 -8.66051e+003  8.37177e+003         00000  
     2         00000         00000         00000  
     3         00000         00000         00000  
     4         00000         00000         00000  
     5         00000         00000         00000  
     6         00000         00000         00000  
     7         00000         00000         00000  
     8         00000         00000         00000  
     9  1.92900e+000         00000         00000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1         00000         00000 -1.15941e+004  
     2         00000         00000         00000  
     3         00000         00000         00000  
     4         00000         00000         00000  
     5         00000         00000         00000  
     6         00000         00000         00000  
     7         00000         00000         00000  
     8         00000         00000         00000  
     9         00000         00000 -3.24420e+001  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "Mf", "Mxf" 
Values 
     1 2.23538e+001  2.42528e+000  0.0 
     2 1.16974e+001  -3.03358e-001  0.0 
     3 -3.27380e+000  -3.86721e+000  0.0 
     4 -8.01838e+000  -4.42301e+000  0.0 
     5 -7.18586e+000  -3.43010e+000  0.0 
     6 -4.37607e+000  -2.02073e+000  0.0 
     7 -1.71882e+000  -9.09601e-001  0.0 
     8 -5.01453e-001  -4.44138e-001  0.0 
     9 -3.93936e-001  -3.93936e-001  0.0 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Qz" 
Values 
     1 0.0  0.0  4.47291e+000 
     2 0.0  0.0  3.24971e+000 
     3 0.0  0.0  1.20619e+000 
     4 0.0  0.0  -1.24533e-002 
     5 0.0  0.0  -5.12561e-001 
     6 0.0  0.0  -5.53013e-001 
     7 0.0  0.0  -3.45407e-001 
     8 0.0  0.0  1.19360e-001 
     9 0.0  0.0  4.37844e-001 
End Values 
Result "Membrane" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Nx", "Nf", "Nxf" 
Values 
     1 -3.80825e+001  -8.49353e+000  0.0 
     2 -3.96911e+001  -1.28596e+001  0.0 
     3 -4.27562e+001  -2.33793e+001  0.0 
     4 -4.52494e+001  -3.43800e+001  0.0 
     5 -4.68944e+001  -4.20573e+001  0.0 
     6 -4.77999e+001  -4.61368e+001  0.0 
     7 -4.82239e+001  -4.77898e+001  0.0 
     8 -4.84221e+001  -4.82989e+001  0.0 
     9 -4.84937e+001  -4.84043e+001  0.0 
End Values 
